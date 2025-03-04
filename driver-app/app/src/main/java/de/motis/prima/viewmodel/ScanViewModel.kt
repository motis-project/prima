package de.motis.prima.viewmodel

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import de.motis.prima.data.DataRepository
import de.motis.prima.services.ApiService
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class ScanViewModel @Inject constructor(
    private val apiService: ApiService,
    private val repository: DataRepository
) : ViewModel() {
    fun reportTicketScan(requestId: Int, ticketCode: String) {
        viewModelScope.launch {
            var isReported = false
            try {
                val response = apiService.validateTicket(requestId, ticketCode)
                if (response.isSuccessful) {
                    isReported = true
                } else {
                    Log.d("error", response.toString())
                }
            } catch (e: Exception) {
                Log.d("error", "Network Error: ${e.message!!}")
            } finally {
                repository.updateValidTickets(requestId, ticketCode, isReported)
            }
        }
    }
}
