package de.motis.prima.data

import de.motis.prima.services.Vehicle
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.security.MessageDigest
import javax.inject.Inject

data class Ticket(
    val requestId: Int,
    val ticketCode: String,
    val isReported: Boolean
)

class DataRepository @Inject constructor(
    private val dataStoreManager: DataStoreManager
) {
    val isDarkMode: Flow<Boolean> = dataStoreManager.darkModeFlow

    suspend fun setDarkMode(enabled: Boolean) {
        dataStoreManager.setDarkMode(enabled)
    }

    fun logout() {
        dataStoreManager.clearCookies()
    }

    private val _validTickets = MutableStateFlow(mutableMapOf<String, Ticket>())
    val validTickets = _validTickets.asStateFlow()

    fun updateValidTickets(requestId: Int, ticketCode: String, reported: Boolean) {
        _validTickets.value[md5(ticketCode)] = Ticket(requestId, ticketCode, reported)
    }

    private fun md5(input: String): String {
        val bytes = MessageDigest.getInstance("MD5").digest(input.toByteArray())
        return bytes.joinToString("") { "%02x".format(it) }
    }

    val selectedVehicle: Flow<Int> = dataStoreManager.selectedVehicleFlow

    suspend fun setSelectedVehicle(id: Int) {
        dataStoreManager.setSelectedVehicle(id)
    }

    private val _vehicles = MutableStateFlow<List<Vehicle>>(emptyList())
    val vehicles: StateFlow<List<Vehicle>> = _vehicles.asStateFlow()

    fun setVehicles(vehicles: List<Vehicle>) {
        _vehicles.value = vehicles
    }
}
