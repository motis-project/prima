package de.motis.prima.data

import android.util.Log
import de.motis.prima.EventGroup
import de.motis.prima.Location
import de.motis.prima.services.Tour
import de.motis.prima.services.Vehicle
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.security.MessageDigest
import javax.inject.Inject

enum class ValidationStatus {
    FAILED, REJECTED, OK
}

data class Ticket(
    val requestId: Int,
    val ticketCode: String,
    var validationStatus: ValidationStatus
)

class DataRepository @Inject constructor(
    private val dataStoreManager: DataStoreManager
) {
    private val _scannedTickets = MutableStateFlow(mutableMapOf<String, Ticket>())
    val scannedTickets = _scannedTickets.asStateFlow()

    fun getTicketStatus(ticketCode: String): ValidationStatus? {
        var res: ValidationStatus?
        res = _scannedTickets.value[ticketCode]?.validationStatus
        if (res == null) {
            res = _scannedTickets.value[md5(ticketCode)]?.validationStatus
        }
        return res
    }

    fun updateScannedTickets(ticket: Ticket) {
        val entry = _scannedTickets.value[md5(ticket.ticketCode)]
        if (entry != null) {
            entry.validationStatus = ticket.validationStatus
        } else {
            _scannedTickets.value[md5(ticket.ticketCode)] = ticket
        }
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

    fun setTours(tours: List<Tour>) {
        _tours.value = tours
    }

    private val _selectedTourId = MutableStateFlow<Int>(0)
    val selectedTourId: StateFlow<Int> = _selectedTourId.asStateFlow()

    fun setSelectedTourId(id: Int) {
        _selectedTourId.value = id
    }

    private val _eventGroups = MutableStateFlow<List<EventGroup>>(emptyList())
    val eventGroups: StateFlow<List<EventGroup>> = _eventGroups.asStateFlow()

    fun updateEventGroups() {
        val events = _tours.value.find { t -> t.tourId == _selectedTourId.value }?.events
        if (events == null) {
            _eventGroups.value = emptyList()
            return
        }

        val eventGroups = mutableListOf<EventGroup>()

        for (event in events) {
            val matchingGroups = eventGroups.filter { group -> group.id == event.eventGroup }
            // size of matchingGroups should be 0 or 1
            if (matchingGroups.isEmpty()) {
                eventGroups.add(
                    EventGroup(
                        event.eventGroup,
                        event.scheduledTimeStart,
                        Location(event.lat, event.lng),
                        event.address,
                        mutableListOf(event),
                        0,
                        false
                    )
                )
            } else if (matchingGroups.size == 1) {
                matchingGroups[0].events.add(event)
            } else {
                Log.d("error", "buildEventGroups: groupId not unique")
            }
        }

        if (eventGroups.isNotEmpty()) {
            eventGroups.sortBy { it.arrivalTime }
            eventGroups.forEachIndexed { index, group ->
                group.stopIndex = index
                val pickupEvent = group.events.find { e -> e.isPickup }
                group.hasPickup = (pickupEvent != null)
            }
        }

        _eventGroups.value = eventGroups
    }

    fun getEventGroup(id: String): EventGroup? {
        return _eventGroups.value.find { e -> e.id == id }
    }
}
