package de.motis.prima.data

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
import retrofit2.Response
import java.security.MessageDigest
import java.time.LocalDate
import java.time.ZoneId
import java.util.Date
import javax.inject.Inject

class DataRepository @Inject constructor(
    private val dataStoreManager: DataStoreManager,
    private val ticketStore: TicketStore,
    private val tourStore: TourStore,
    private val apiService: ApiService
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

    init {
        startRefreshingTours()
    }

    fun resetTokenPending() {
        CoroutineScope(Dispatchers.IO).launch {
            dataStoreManager.resetTokenPending()
        }
    }

    private fun refreshToursDisplayDate() {
        val today = displayDate.value

        val tomorrow = today.plusDays(1)
        val start = today.atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()
        val end = tomorrow.atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val response = apiService.getTours(start, end)
                val fetchedTours = response.body() ?: emptyList()
                setTours(fetchedTours)
            } catch (e: Exception) {
                _networkError.value = true
            }
        }
    }

    private fun refreshTours(): Flow<Response<List<Tour>>> = flow {
        while (true) {
            val today = LocalDate.now()

            if (today == displayDate.value) {
                val tomorrow = today.plusDays(1)
                val start = today.atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()
                val end = tomorrow.atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()

                try {
                    val response = apiService.getTours(start, end)
                    emit(response)
                } catch (e: Exception) {
                    _networkError.value = true
                    val toursDate = getToursForDate(_displayDate.value, selectedVehicle.first().id)
                    _toursForDate.value = toursDate
                }
                delay(10000) // 10 sec
            }
        }
    }.flowOn(Dispatchers.IO)

    private fun startRefreshingTours() {
        CoroutineScope(Dispatchers.IO).launch {
            _vehicleId = selectedVehicle.first().id
            _toursForDate.value = getToursForDate(_displayDate.value, selectedVehicle.first().id)
            refreshTours().collect { response ->
                if (response.isSuccessful) {
                    _networkError.value = false
                    val fetchedTours = response.body() ?: emptyList()

                    var tours = fetchedTours.filter { t -> t.vehicleId == selectedVehicle.first().id }
                    tours = tours.sortedBy { t -> t.events[0].scheduledTimeStart }

                    setTours(fetchedTours)
                    _toursCache.value = tours
                } else {
                    _networkError.value = true
                }
            }
        }
    }

    private fun fetchTours() {
        val displayDay = _displayDate.value
        val nextDay = displayDay.plusDays(1)
        val start = displayDay.atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()
        val end = nextDay.atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val response = apiService.getTours(start, end)
                if (response.isSuccessful) {
                    _networkError.value = false
                    val fetchedTours = response.body() ?: emptyList()

                    var tours = fetchedTours.filter { t -> t.vehicleId == _vehicleId }
                    tours = tours.sortedBy { t -> t.events[0].scheduledTimeStart }

                    setTours(fetchedTours)

                    _toursForDate.value = getToursForDate(_displayDate.value, _vehicleId)
                    _toursCache.value = tours
                }
            } catch (e: Exception) {
                _networkError.value = true
                _toursForDate.value = getToursForDate(_displayDate.value, _vehicleId)
            }
        }
    }

    fun resetDate() {
        _displayDate.value = LocalDate.now()
        fetchTours()
        _toursForDate.value = getToursForDate(_displayDate.value, _vehicleId)
    }

    fun incrementDate() {
        _displayDate.value = _displayDate.value.plusDays(1)
        fetchTours()
        _toursForDate.value = getToursForDate(_displayDate.value, _vehicleId)
    }

    fun decrementDate() {
        _displayDate.value = _displayDate.value.minusDays(1)
        fetchTours()
        _toursForDate.value = getToursForDate(_displayDate.value, _vehicleId)
    }

    private fun getToursForDate(date: LocalDate, vehicleId: Int): List<Tour> {
        refreshToursDisplayDate();

        val start = date.atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()
        val end = date.plusDays(1).atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()
        val tours = tourStore.getToursForInterval(start, end)
        var res = tours.filter { t -> t.vehicleId == vehicleId }
        res = res.sortedBy { t -> t.events[0].scheduledTimeStart }
        return res
    }

    fun getTicketStatus(ticketCode: String): ValidationStatus? {
        return ticketStore.getTicketStatus(ticketCode)
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
    val tours: StateFlow<List<Tour>> = _tours.asStateFlow()

    private fun setTours(tours: List<Tour>) {
        _tours.value = tours
        for (tour in tours) {
            val ticketValidated = tour.events.find { e -> e.ticketChecked } == null
            val fareReported = tour.fare != 0
            tourStore.update(tour, ticketValidated, fareReported)
        }
    }

    private val _eventObjectGroups = MutableStateFlow<List<EventObjectGroup>>(emptyList())
    val eventObjectGroups: StateFlow<List<EventObjectGroup>> = _eventObjectGroups.asStateFlow()

    fun updateEventGroups(tourId: Int) {
        _eventObjectGroups.value = tourStore.getEventGroupsForTour(tourId)
    }

    fun getEventGroup(id: String): EventObjectGroup? {
        return _eventObjectGroups.value.find { e -> e.id == id }
    }

    suspend fun updateTicketStore(ticket: Ticket) {
        ticketStore.update(ticket)
        _pendingValidationTickets.value = ticketStore
            .getTicketsByValidationStatus(ValidationStatus.CHECKED_IN)
    }

    suspend fun updateTourStore(tourId: Int, fareCent: Int, fareReported: Boolean) {
        tourStore.updateFare(tourId, fareCent, fareReported)
    }

    fun getTicketsByValidationStatus(status: ValidationStatus): RealmResults<TicketObject> {
        return ticketStore.getTicketsByValidationStatus(status)
    }

    fun getToursUnreportedFare(): List<TourObject> {
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

    fun hasValidTicket(tourId: Int, eventId: Int): Boolean {
        val event = tourStore.getEventsForTour(tourId).find { e -> e.id == eventId }
        if (event != null) {
            return event.ticketChecked
        }
        return false
    }

    fun isTourStarted(tourId: Int): Boolean {
        val tour = tourStore.getTour(tourId)
        if (tour != null) {
            return Date(tour.startTime) < Date()
        }
        return false
    }
}
