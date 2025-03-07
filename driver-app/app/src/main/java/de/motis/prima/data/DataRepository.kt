package de.motis.prima.data

import android.util.Log
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
        return _scannedTickets.value[md5(ticketCode)]?.validationStatus
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
}
