package de.motis.prima.viewmodel

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import de.motis.prima.data.DataRepository
import de.motis.prima.data.ValidationStatus
import de.motis.prima.services.ApiService
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class ScanViewModel @Inject constructor(
    private val apiService: ApiService,
    private val repository: DataRepository
) : ViewModel() {
    fun reportTicketScan(requestId: Int, ticketCode: String) {
        Log.d("debug", "reportTicketScan: requestId: $requestId")
        val ticketStatus = repository.getTicketStatus(ticketCode)
        val shouldReport =
            ticketStatus != ValidationStatus.OK && ticketStatus != ValidationStatus.REJECTED
        Log.d("debug", "shouldReport: $shouldReport, status: $ticketStatus")
        if (shouldReport) {
            viewModelScope.launch {
                var validationStatus = ValidationStatus.OK
                try {
                    val response = apiService.validateTicket(requestId, ticketCode)
                    if (!response.isSuccessful) {
                        validationStatus = ValidationStatus.REJECTED
                    }
                } catch (e: Exception) {
                    validationStatus = ValidationStatus.FAILED
                    Log.d("error", "Network Error: ${e.message!!}")
                } finally {
                    repository.updateScannedTickets(requestId, ticketCode, validationStatus)
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
}
