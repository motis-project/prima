package de.motis.prima.viewmodel

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import de.motis.prima.data.DataRepository
import de.motis.prima.data.EventObjectGroup
import de.motis.prima.data.Ticket
import de.motis.prima.data.ValidationStatus
import de.motis.prima.services.ApiService
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class ScanViewModel @Inject constructor(
    private val apiService: ApiService,
    private val repository: DataRepository
) : ViewModel() {

    fun reportTicketScan(requestId: Int, ticketHash: String, ticketCode: String) {
        val ticketStatus = repository.getTicketStatus(ticketCode)
        val shouldReport =
            ticketStatus != ValidationStatus.DONE && ticketStatus != ValidationStatus.REJECTED
        if (shouldReport) {
            viewModelScope.launch {
                var validationStatus = ValidationStatus.DONE
                try {
                    val response = apiService.validateTicket(requestId, ticketCode)
                    if (!response.isSuccessful) {
                        validationStatus = ValidationStatus.REJECTED
                    }
                } catch (e: Exception) {
                    validationStatus = ValidationStatus.CHECKED_IN
                    Log.d("error", "Network Error: ${e.message!!}")
                } finally {
                    repository.updateTicketStore(Ticket(requestId, ticketHash, ticketCode, validationStatus))
                }
            }
        }
    }

    fun getActiveHash(ticketCode: String): String? {
        return if (repository.getTicketStatus(ticketCode) == null) {
            repository.md5(ticketCode)
        } else {
            null
        }
    }

    fun getEventGroup(id: String): EventObjectGroup? {
        return repository.getEventGroup(id)
    }
}
