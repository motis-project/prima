package de.motis.prima.data

import android.util.Log
import de.motis.prima.EventGroup
import de.motis.prima.Location
import de.motis.prima.services.Tour
import de.motis.prima.services.Vehicle
import io.realm.kotlin.query.RealmResults
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.security.MessageDigest
import javax.inject.Inject

class DataRepository @Inject constructor(
    private val dataStoreManager: DataStoreManager,
    private val ticketStore: TicketStore,
    private val tourStore: TourStore
) {
    val storedTickets = ticketStore.storedTickets
    val storedTours = tourStore.storedTours

    private val _pendingValidationTickets = MutableStateFlow<List<TicketObject>>(emptyList())

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
        _tours.value = tours
        for (tour in tours) {
            val ticketValidated = tour.events.find { e -> e.ticketChecked } == null
            val fareReported = tour.fare != 0
            val tourDTO = TourDTO(tour.tourId, ticketValidated, tour.fare, fareReported)
            tourStore.update(tourDTO)

            for (event in tour.events) {
                val validationStatus =
                    if (event.ticketChecked) ValidationStatus.DONE else ValidationStatus.REJECTED
                ticketStore.update(Ticket(
                    event.requestId,
                    event.ticketHash,
                    "",
                    validationStatus
                ))
            }
        }
    }

    private val _eventGroups = MutableStateFlow<List<EventGroup>>(emptyList())
    val eventGroups: StateFlow<List<EventGroup>> = _eventGroups.asStateFlow()

    fun updateEventGroups(tourId: Int) {
        val events = _tours.value.find { t -> t.tourId == tourId }?.events
        if (events == null) {
            _eventGroups.value = emptyList()
            return
        }

        val tmpEventGroups = mutableListOf<EventGroup>()
        val groupIDs = mutableSetOf<String>()

        for (event in events) {
            groupIDs.add(event.eventGroup)
        }

        for (id in groupIDs) {
            val group = events.filter { e -> e.eventGroup == id }
            if (group.isNotEmpty()) {
                tmpEventGroups.add(
                    EventGroup(
                        group[0].eventGroup,
                        group[0].scheduledTimeStart,
                        Location(group[0].lat, group[0].lng),
                        group[0].address,
                        group,
                        0,
                        false
                    )
                )
            }
        }

        if (tmpEventGroups.isNotEmpty()) {
            tmpEventGroups.sortBy { it.arrivalTime }
            tmpEventGroups.forEachIndexed { index, group ->
                group.stopIndex = index
                val pickupEvent = group.events.find { e -> e.isPickup }
                group.hasPickup = (pickupEvent != null)
            }
        }

        _eventGroups.value = tmpEventGroups
    }

    fun getEventGroup(id: String): EventGroup? {
        return _eventGroups.value.find { e -> e.id == id }
    }

    suspend fun updateTicketStore(ticket: Ticket) {
        ticketStore.update(ticket)
        _pendingValidationTickets.value = ticketStore
            .getTicketsByValidationStatus(ValidationStatus.CHECKED_IN)
    }

    suspend fun updateTourStore(tour: TourDTO) {
        tourStore.update(tour)
    }

    fun getTicketsByValidationStatus(status: ValidationStatus): RealmResults<TicketObject> {
        return ticketStore.getTicketsByValidationStatus(status)
    }
}
