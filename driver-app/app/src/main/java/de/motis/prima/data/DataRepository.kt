package de.motis.prima.data

import android.util.Log
import de.motis.prima.EventGroup
import de.motis.prima.Location
import de.motis.prima.app.NotificationHelper
import de.motis.prima.formatTo
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
    private val apiService: ApiService,
    private val notificationHelper: NotificationHelper
) {
    val storedTickets = ticketStore.storedTickets
    val storedTours = tourStore.storedTours

    private val _pendingValidationTickets = MutableStateFlow<List<TicketObject>>(emptyList())

    val tmp = startRefreshingTours()
    val channel = notificationHelper.createNotificationChannel()

    private val _toursCache = MutableStateFlow<List<Tour>>(emptyList())
    val toursCache: StateFlow<List<Tour>> = _toursCache.asStateFlow()

    fun updateToursCache(tours: List<Tour>) {
        _toursCache.value = tours
    }

    private fun refreshTours(): Flow<Response<List<Tour>>> = flow {
        while (true) {
            val today = LocalDate.now()
            val tomorrow = today.plusDays(1)
            val start = today.atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()
            val end = tomorrow.atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()

            try {
                val response = apiService.getTours(start, end)
                emit(response)
            } catch (e: Exception) {
                Log.e("error", "Exception: ${e.message}")
            }
            delay(10000) // 10 sec
        }
    }.flowOn(Dispatchers.IO)

    private fun startRefreshingTours() {
        CoroutineScope(Dispatchers.IO).launch {
            refreshTours().collect { response ->
                if (response.isSuccessful) {
                    var fetchedTours = response.body() ?: emptyList()

                    fetchedTours = fetchedTours.sortedBy { t -> t.events[0].scheduledTimeStart }

                    if (fetchedTours.size > _toursCache.value.size) {
                        val newItem = fetchedTours.last()
                        val pickup = newItem.events.first()
                        val currentDay = Date().formatTo("yyyy-MM-dd")
                        val pickupDate = Date(pickup.scheduledTimeStart)
                        val pickupDay = pickupDate.formatTo("yyyy-MM-dd")
                        val pickupTime = pickupDate.formatTo("HH:mm")

                        Log.d("test", "update: vehicle: ${selectedVehicle.first().id}")
                        if (pickupDay == currentDay && newItem.vehicleId == selectedVehicle.first().id) {
                            notificationHelper.showNotification(
                                "Neue Fahrt",
                                "$pickupTime, ${pickup.address}"
                            )
                        }
                    }

                    _toursCache.value = fetchedTours
                    setTours(fetchedTours)
                } else {
                    Log.d("debug", "fetchTours: $response")
                }
            }
        }
    }

    fun getToursForDate(date: LocalDate): List<Tour> {
        val start = date.atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()
        val end = date.plusDays(1).atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()
        return tourStore.getToursForInterval(start, end)
    }

    fun getTicketStatus(ticketCode: String): ValidationStatus? {
        return ticketStore.getTicketStatus(ticketCode)
    }

    fun md5(input: String): String {
        val bytes = MessageDigest.getInstance("MD5").digest(input.toByteArray())
        return bytes.joinToString("") { "%02x".format(it) }
    }

    val selectedVehicle: Flow<Vehicle> = dataStoreManager.selectedVehicleFlow

    suspend fun setSelectedVehicle(vehicle: Vehicle) {
        dataStoreManager.setSelectedVehicle(vehicle)
    }

    private val _vehicles = MutableStateFlow<List<Vehicle>>(emptyList())
    val vehicles: StateFlow<List<Vehicle>> = _vehicles.asStateFlow()

    fun setVehicles(vehicles: List<Vehicle>) {
        _vehicles.value = vehicles
    }

    private val _tours = MutableStateFlow<List<Tour>>(emptyList())
    val tours: StateFlow<List<Tour>> = _tours.asStateFlow()

    suspend fun setTours(tours: List<Tour>) {
        Log.d("test", "setTours")
        _tours.value = tours
        for (tour in tours) {
            val ticketValidated = tour.events.find { e -> e.ticketChecked } == null
            val fareReported = tour.fare != 0
            tourStore.update(tour, ticketValidated, fareReported)
        }
    }

    private val _eventObjectGroups = MutableStateFlow<List<EventObjectGroup>>(emptyList())
    val eventObjectGroups: StateFlow<List<EventObjectGroup>> = _eventObjectGroups.asStateFlow()

    fun updateEventGroups(tourId: Int) {//}: List<EventObjectGroup> {
        _eventObjectGroups.value = tourStore.getEventGroupsForTour(tourId)
        //return tourStore.getEventGroupsForTour(tourId)
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
}
