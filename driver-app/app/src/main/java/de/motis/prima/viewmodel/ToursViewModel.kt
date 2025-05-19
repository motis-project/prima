package de.motis.prima.viewmodel

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import de.motis.prima.data.DataRepository
import de.motis.prima.data.Ticket
import de.motis.prima.data.TourObject
import de.motis.prima.data.ValidationStatus
import de.motis.prima.services.ApiService
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class ToursViewModel @Inject constructor(
    private val apiService: ApiService,
    private val repository: DataRepository
) : ViewModel() {

    var toursCache = repository.toursCache
    val displayDate = repository.displayDate
    val toursForDate = repository.toursForDate
    val networkError = repository.networkError
    var selectedVehicle = repository.selectedVehicle
        .stateIn(viewModelScope, SharingStarted.Eagerly, null)

    private val _loading = MutableStateFlow(false)
    val loading: StateFlow<Boolean> = _loading.asStateFlow()

    private val _showAll = MutableStateFlow(false)
    val showAll: StateFlow<Boolean> = _showAll.asStateFlow()

    private val _intentSeen = MutableStateFlow(false)
    val intentSeen: StateFlow<Boolean> = _intentSeen.asStateFlow()

    val markedTour: StateFlow<Int> = repository.markedTour

    init {
        startReporting()
    }

    private fun retryFailedReport(ticket: Ticket) {
        viewModelScope.launch {
            try {
                val response = apiService.validateTicket(ticket.requestId, ticket.ticketCode)
                if (response.isSuccessful) {
                    ticket.validationStatus = ValidationStatus.DONE
                    repository.updateTicketStore(ticket)
                } else {
                    ticket.validationStatus = ValidationStatus.REJECTED
                    repository.updateTicketStore(ticket)
                }
            } catch (e: Exception) {
                Log.d("error", "Network Error: ${e.message!!}")
            }
        }
    }

    private fun retryFareReport(tour: TourObject) {
        viewModelScope.launch {
            try {
                val response = apiService.reportFare(tour.tourId, tour.fare)
                if (response.isSuccessful) {
                    Log.d("report", "Fare reported")
                    repository.updateTourStore(tour.tourId, tour.fare, true)
                } else {
                    Log.d("report", "Fare report failed")
                }
            } catch (e: Exception) {
                Log.d("error", "Network Error: ${e.message!!}")
            }
        }
    }

    private fun startReporting() {
        viewModelScope.launch {
            while (true) {
                val failedReports = repository.getTicketsByValidationStatus(ValidationStatus.CHECKED_IN)
                Log.d("report", "Failed scan reports: $failedReports")
                for (report in failedReports) {
                    retryFailedReport(
                        Ticket(
                            report.requestId,
                            report.ticketHash,
                            report.ticketCode,
                            ValidationStatus.valueOf(report.validationStatus)
                        )
                    )
                }

                val failedFareReports = repository.getToursUnreportedFare()
                Log.d("report", "Failed fare reports: $failedFareReports")
                for (report in failedFareReports) {
                    retryFareReport(report)
                }

                delay(120000) // 2 min
            }
        }
    }

    fun resetDate() {
        repository.resetDate()
    }

    fun incrementDate() {
        repository.incrementDate()
    }

    fun decrementDate() {
        repository.decrementDate()
    }

    fun updateEventGroups(tourId: Int) {
        repository.updateEventGroups(tourId)
    }

    fun getFareString(tourId: Int): String {
        val tour = repository.getTour(tourId)
        var res = ""
        if (tour != null) {
            val fare = ((tour.fare) * 1.0 / 100)
            val rounded = String.format("%.2f", fare).replace('.', ',')
            res = "$rounded Euro"
        }
        return res
    }

    fun isCancelled(tourId: Int): Boolean {
        return repository.isTourCancelled(tourId)
    }

    fun setShowAll(value: Boolean) {
        _showAll.value = value
    }

    fun addMarker(tourId: Int) {
        repository.addMarker(tourId)
        _intentSeen.value = false
    }

    fun removeMarker() {
        repository.removeMarker()
        _intentSeen.value = true
    }
}
