package de.motis.prima.data

import android.content.Context
import android.content.res.Configuration
import android.util.Log
import com.google.firebase.messaging.FirebaseMessaging
import de.motis.prima.services.ApiService
import de.motis.prima.services.Tour
import de.motis.prima.services.Vehicle
import io.realm.kotlin.query.RealmResults
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOn
import kotlinx.coroutines.launch
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import java.security.MessageDigest
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import javax.inject.Inject

data class TourSpecialInfo(
    var wheelChairs: Int = 0,
    var kidsZeroToTwo: Int = 0,
    var kidsThreeToFour: Int = 0,
    var kidsFiveToSix: Int = 0,
    var hasInfo: Boolean = false
)

class DataRepository @Inject constructor(
    private val dataStoreManager: DataStoreManager,
    private val ticketStore: TicketStore,
    private val tourStore: TourStore,
    private val apiService: ApiService,
    private val context: Context
) {
    val storedTickets = ticketStore.storedTickets
    val storedTours = tourStore.storedTours

    private val _pendingValidationTickets = MutableStateFlow<List<TicketObject>>(emptyList())
    val pendingValidationTickets = _pendingValidationTickets.asStateFlow()

    private val _toursCache = MutableStateFlow<List<Tour>>(emptyList())
    val toursCache: StateFlow<List<Tour>> = _toursCache.asStateFlow()

    private val _toursForDate = MutableStateFlow<List<Tour>>(emptyList())
    val toursForDate = _toursForDate.asStateFlow()

    private val _displayDate = MutableStateFlow(LocalDate.now())
    val displayDate = _displayDate.asStateFlow()

    private val _networkError = MutableStateFlow(false)
    val networkError = _networkError.asStateFlow()

    val selectedVehicle: Flow<Vehicle> = dataStoreManager.selectedVehicleFlow
    private var _vehicleId = 0

    val deviceInfo: Flow<DeviceInfo> = dataStoreManager.deviceInfoFlow

    private val _markedTour = MutableStateFlow(-1)
    val markedTour: StateFlow<Int> = _markedTour.asStateFlow()

    private val _eventObjectGroups = MutableStateFlow<List<EventObjectGroup>>(emptyList())
    val eventObjectGroups: StateFlow<List<EventObjectGroup>> = _eventObjectGroups.asStateFlow()

    private var fetchTours = false

    private val _darkTheme = MutableStateFlow(false)
    val darkTheme: StateFlow<Boolean> = _darkTheme.asStateFlow()

    fun toggleTheme() {
        _darkTheme.value = !_darkTheme.value
        CoroutineScope(Dispatchers.IO).launch {
            dataStoreManager.setTheme(_darkTheme.value)
        }
    }

    private fun initializeTheme() {
        if (isSystemDarkMode(context)) {
            _darkTheme.value =  true
        } else {
            CoroutineScope(Dispatchers.IO).launch {
                _darkTheme.value = dataStoreManager.uiThemeFlow.first()
            }
        }
    }

    private fun isSystemDarkMode(context: Context): Boolean {
        return (context.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) ==
                Configuration.UI_MODE_NIGHT_YES
    }

    init {
        initializeTheme()
        fetchFirebaseToken()
        startRefreshingTours()
        startReporting()
    }

    fun removeFirebaseToken() {
        FirebaseMessaging.getInstance().deleteToken()
            .addOnCompleteListener { task ->
                if (task.isSuccessful) {
                    Log.d("fcm", "Token deleted successfully")
                } else {
                    Log.e("fcm", "Failed to delete token", task.exception)
                }
            }
    }

    fun fetchFirebaseToken() {
        FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
            if (task.isSuccessful) {
                val token = task.result
                Log.d("fcm", "Received new token")
                CoroutineScope(Dispatchers.IO).launch {
                    try {
                        dataStoreManager.setDeviceInfo(token, true)
                    } catch (e: Exception) {
                        Log.e("fcm", "Failed to store token", e)
                    }
                    try {
                        val resFCM = apiService.sendDeviceInfo(dataStoreManager.getDeviceId(), token)
                        if (resFCM.isSuccessful) {
                            resetTokenPending()
                            Log.d("fcm", "Token was sent to backend")
                        } else {
                            Log.e("fcm", "Failed to send token to backend")
                        }
                    } catch (e: Exception) {
                        Log.e("fcm", "$e")
                    }
                }
            } else {
                Log.w("fcm", "Fetching token failed", task.exception)
            }
        }
    }

    fun resetTokenPending() {
        CoroutineScope(Dispatchers.IO).launch {
            dataStoreManager.resetTokenPending()
        }
    }

    fun stopFetchingTours() {
        fetchTours = false
    }

    private fun refreshTours(): Flow<Response<List<Tour>>> = flow {
        while (fetchTours) {
            val today = LocalDate.now()

            if (today == displayDate.value) {
                val tomorrow = today.plusDays(1)
                val start = today.atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()
                val end = tomorrow.atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()

                try {
                    emit(apiService.getTours(start, end))
                } catch (e: Exception) {
                    _networkError.value = true
                    _toursForDate.value = getToursForDate()
                }
                delay(10000) // 10 sec
            }
        }
    }.flowOn(Dispatchers.IO)

    fun startRefreshingTours() {
        fetchTours = true
        CoroutineScope(Dispatchers.IO).launch {
            _vehicleId = selectedVehicle.first().id
            _toursForDate.value = getToursForDate()
            refreshTours().collect { response ->
                if (response.isSuccessful) {
                    _networkError.value = false
                    val fetchedTours = response.body() ?: emptyList()

                    val tours = fetchedTours
                        .filter { t -> t.vehicleId == selectedVehicle.first().id }

                    setTours(fetchedTours)
                    _toursCache.value = tours
                } else {
                    _networkError.value = true
                }
            }
        }
        // test TODO
        fetchTours = false
    }

    private fun localDateFromEpochMillis(epochMillis: Long): LocalDate {
        return Instant.ofEpochMilli(epochMillis)
            .atZone(ZoneId.systemDefault())
            .toLocalDate()
    }

    fun fetchTours(time: Long? = null) {
        var displayDay = _displayDate.value

        if (time != null) {
            displayDay = localDateFromEpochMillis(time)
        }

        val nextDay = displayDay.plusDays(1)
        val start = displayDay.atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()
        val end = nextDay.atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()

        CoroutineScope(Dispatchers.IO).launch {
            _toursForDate.value = getToursForDate()
            try {
                val response = apiService.getTours(start, end)
                if (response.isSuccessful) {
                    _networkError.value = false
                    val fetchedTours = response.body() ?: emptyList()
                    setTours(fetchedTours)
                    if (time == null) {
                        _toursCache.value = fetchedTours
                            .filter { t -> t.vehicleId == _vehicleId }
                    }
                }
            } catch (e: Exception) {
                _networkError.value = true
                Log.e("error", "fetchTours: ${e.message}")
            }
        }
    }

    private fun retryScanReport(ticket: Ticket) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val response = apiService.validateTicket(ticket.requestId, ticket.ticketCode)
                if (response.isSuccessful) {
                    ticket.validationStatus = ValidationStatus.DONE
                    updateTicketStore(ticket)
                } else {
                    ticket.validationStatus = ValidationStatus.REJECTED
                    updateTicketStore(ticket)
                }
            } catch (e: Exception) {
                Log.d("error", "Network Error: ${e.message!!}")
            }
        }
    }

    private fun retryFareReport(tour: TourObject) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val response = apiService.reportFare(tour.tourId, tour.fare)
                if (response.isSuccessful) {
                    updateTourStore(tour.tourId, tour.fare, true)
                }
            } catch (e: Exception) {
                Log.d("error", "Network Error: ${e.message!!}")
            }
        }
    }

    private fun startReporting() {
        CoroutineScope(Dispatchers.IO).launch {
            while (true) {
                val failedScanReports = getTicketsByValidationStatus(ValidationStatus.CHECKED_IN)
                for (ticket in failedScanReports) {
                    retryScanReport(
                        Ticket(
                            ticket.requestId,
                            ticket.ticketHash,
                            ticket.ticketCode,
                            ValidationStatus.valueOf(ticket.validationStatus)
                        )
                    )
                }

                val failedFareReports = getToursUnreportedFare()
                for (tour in failedFareReports) {
                    if (tour.fare > 0) {
                        retryFareReport(tour)
                    }
                }

                delay(10000)
            }
        }
    }

    fun resetDate() {
        _displayDate.value = LocalDate.now()
        fetchTours()
    }

    fun incrementDate() {
        _displayDate.value = _displayDate.value.plusDays(1)
        fetchTours()
    }

    fun decrementDate() {
        _displayDate.value = _displayDate.value.minusDays(1)
        fetchTours()
    }

    private suspend fun getToursForDate(): List<Tour> {
        val date = _displayDate.value
        val start = date.atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()
        val end = date.plusDays(1).atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()
        val tours = tourStore.getToursForInterval(start, end)
        val res = tours
            .filter { t -> t.vehicleId == selectedVehicle.first().id }
        return res
    }

    fun getTicketStatus(ticketCode: String): ValidationStatus? {
        return ticketStore.getTicketStatus(ticketCode)
    }

    fun getTicketsForEventGroup(eventGroupId: String): List<TicketObject> {
        val tickets = mutableListOf<TicketObject>()
        val events = eventObjectGroups.value
            .find { e -> e.id == eventGroupId }?.events?.filter { e -> e.isPickup }
        if (events == null) return emptyList()
        for (e in events) {
            val ticket = ticketStore.getTicketByRequestId(e.requestId)
            if (ticket != null) {
                tickets.add(ticket)
            }
        }
        return tickets
    }

    fun md5(input: String): String {
        val bytes = MessageDigest.getInstance("MD5").digest(input.toByteArray())
        return bytes.joinToString("") { "%02x".format(it) }
    }

    fun setSelectedVehicle(vehicle: Vehicle) {
        _displayDate.value = LocalDate.now()
        _vehicleId = vehicle.id
        fetchTours()
        CoroutineScope(Dispatchers.IO).launch {
            dataStoreManager.setSelectedVehicle(vehicle)
        }
    }

    private val _vehicles = MutableStateFlow<List<Vehicle>>(emptyList())
    val vehicles: StateFlow<List<Vehicle>> = _vehicles.asStateFlow()

    fun setVehicles(vehicles: List<Vehicle>) {
        _vehicles.value = vehicles
    }

    private val _tours = MutableStateFlow<List<Tour>>(emptyList())

    private fun setTours(tours: List<Tour>) {
        try {
            _tours.value = tours
            for (tour in tours) {
                tourStore.update(tour)
            }
        } catch (e: Exception) {
            Log.e("error", "setTours: ${e.message}")
        }
    }

    fun updateVehicles() {
        apiService.getVehicles().enqueue(object : Callback<List<Vehicle>> {
            override fun onResponse(
                call: Call<List<Vehicle>>,
                response: Response<List<Vehicle>>
            ) {
                if (response.isSuccessful) {
                    setVehicles(response.body() ?: emptyList())
                }
            }

            override fun onFailure(call: Call<List<Vehicle>>, t: Throwable) {
                _networkError.value = true
            }
        })
    }

    fun updateEventGroups(tourId: Int) {
        _eventObjectGroups.value = tourStore.getEventGroupsForTour(tourId)
    }

    fun getEventGroup(id: String): EventObjectGroup? {
        return _eventObjectGroups.value.find { e -> e.id == id }
    }

    fun updateTicketStore(ticket: Ticket) {
        ticketStore.update(ticket)
        _pendingValidationTickets.value = ticketStore
            .getTicketsByValidationStatus(ValidationStatus.CHECKED_IN)
    }

    fun updateTourStore(tourId: Int, fareCent: Int, fareReported: Boolean) {
        tourStore.updateFare(tourId, fareCent, fareReported)
    }

    private fun getTicketsByValidationStatus(status: ValidationStatus): RealmResults<TicketObject> {
        return ticketStore.getTicketsByValidationStatus(status)
    }

    private fun getToursUnreportedFare(): List<TourObject> {
        return tourStore.getToursUnreportedFare()
    }

    fun getTour(id: Int): TourObject? {
        return tourStore.getTour(id)
    }

    fun hasPendingValidations(tourId: Int): Boolean {
        for (id in tourStore.getPickupRequestIDs(tourId)) {
            if (_pendingValidationTickets.value.find { e -> e.requestId == id } != null ) {
                return true
            }
        }
        return false
    }

    fun hasInvalidatedTickets(tourId: Int): Boolean {
        val pickupEvents = tourStore.getEventsForTour(tourId).filter { e -> e.isPickup }
        val invalidated = pickupEvents.filter { e -> e.ticketChecked.not() }
        return invalidated.isNotEmpty()
    }

    fun getTourSpecialInfo(tourId: Int): TourSpecialInfo {
        val tourInfo = TourSpecialInfo()
        val events = tourStore.getEventsForTour(tourId)
        for (e in events) {
            if (e.isPickup.not()) continue
            tourInfo.wheelChairs += e.wheelchairs
            tourInfo.kidsZeroToTwo += e.kidsZeroToTwo
            tourInfo.kidsThreeToFour += e.kidsThreeToFour
            tourInfo.kidsFiveToSix += e.kidsFiveToSix
        }

        val info = tourInfo.wheelChairs + tourInfo.kidsFiveToSix + tourInfo.kidsThreeToFour + tourInfo.kidsZeroToTwo
        tourInfo.hasInfo = info != 0

        return tourInfo
    }

    fun isTourCancelled(tourId: Int): Boolean {
        return tourStore.getEventsForTour(tourId).none { e -> !e.cancelled }
    }

    fun addMarker(tourId: Int) {
        _markedTour.value = tourId
    }

    fun removeMarker() {
        _markedTour.value = -1
    }
}
