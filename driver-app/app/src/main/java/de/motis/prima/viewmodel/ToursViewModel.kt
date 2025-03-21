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
import de.motis.prima.services.Tour
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.ZoneId
import javax.inject.Inject

@HiltViewModel
class ToursViewModel @Inject constructor(
    private val apiService: ApiService,
    private val repository: DataRepository
) : ViewModel() {
    //private val _toursCache = MutableStateFlow<List<Tour>>(emptyList())
    var toursCache = repository.toursCache//.asStateFlow()

    private val _displayDate = MutableStateFlow(LocalDate.now())
    val displayDate = _displayDate.asStateFlow()

    private val _toursForDate = MutableStateFlow(LocalDate.now())
    val toursForDate = _toursForDate.asStateFlow()

    private val _loading = MutableStateFlow(false)
    val loading: StateFlow<Boolean> = _loading.asStateFlow()

    private val _networkError = MutableStateFlow(false)
    val networkError = _networkError.asStateFlow()

    val selectedVehicle = repository.selectedVehicle
        .stateIn(viewModelScope, SharingStarted.Eagerly, null)

    init {
        fetchTours()
        startReporting()
    }

    private fun fetchTours() {
        val displayDay = _displayDate.value
        val nextDay = displayDay.plusDays(1)
        val start = displayDay.atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()
        val end = nextDay.atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()

        viewModelScope.launch {
            try {
                val response = apiService.getTours(start, end)
                if (response.isSuccessful) {
                    val fetchedTours = response.body() ?: emptyList()
                    /*if (_toursCache.value != fetchedTours) {
                        repository.setTours(fetchedTours)
                        val toursForVehicle = fetchedTours.filter { t ->
                            t.vehicleId == selectedVehicle.value?.id
                        }.sortedBy { t -> t.events[0].scheduledTimeStart }

                        /*val toursPast = toursForVehicle.filter { t ->
                            Date(t.events.first().scheduledTimeStart).before(Date()) &&
                                    t.vehicleId == selectedVehicle.value?.id
                        }.sortedBy { t -> t.events[0].scheduledTimeStart }

                        val toursFuture = toursForVehicle.filter { t ->
                            Date(t.events.first().scheduledTimeStart).after(Date()) &&
                                    t.vehicleId == selectedVehicle.value?.id
                        }.sortedBy { t -> t.events[0].scheduledTimeStart }*/

                        //_toursCache.value = toursForVehicle
                        repository.updateToursCache(toursForVehicle)
                    }

                    repository.setTours(fetchedTours)
                    val toursForVehicle = fetchedTours.filter { t ->
                        t.vehicleId == selectedVehicle.value?.id
                    }.sortedBy { t -> t.events[0].scheduledTimeStart }

                    val toursPast = toursForVehicle.filter { t ->
                        Date(t.events.first().scheduledTimeStart).before(Date()) &&
                                t.vehicleId == selectedVehicle.value?.id
                    }.sortedBy { t -> t.events[0].scheduledTimeStart }

                    val toursFuture = toursForVehicle.filter { t ->
                        Date(t.events.first().scheduledTimeStart).after(Date()) &&
                                t.vehicleId == selectedVehicle.value?.id
                    }.sortedBy { t -> t.events[0].scheduledTimeStart }*/

                    //_toursCache.value = toursForVehicle
                    repository.updateToursCache(fetchedTours)
                }
            } catch (e: Exception) {
                Log.e("error", "Exception: ${e.message}")
                var tours = getToursForDate()
                if (selectedVehicle.value != null) {
                    tours = tours.filter { t -> t.vehicleId == selectedVehicle.value!!.id }
                }
                tours = tours.sortedBy { t -> t.events[0].scheduledTimeStart }
                //_toursCache.value = tours
                repository.updateToursCache(tours)
            }
        }
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
                    Log.d("debug", "Fare reported")
                    repository.updateTourStore(tour.tourId, tour.fare, true)
                } else {
                    Log.d("debug", "Fare report failed")
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
                Log.d("debug", "failed scan reports: $failedReports")
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
                Log.d("debug", "failed fare reports: $failedFareReports")
                for (report in failedFareReports) {
                    retryFareReport(report)
                }

                delay(120000) // 2 min
            }
        }
    }

    fun incrementDate() {
        _displayDate.value = _displayDate.value.plusDays(1)
        fetchTours()
    }

    fun decrementDate() {
        _displayDate.value = _displayDate.value.minusDays(1)
        fetchTours()
    }

    fun updateEventGroups(tourId: Int) {
        //_loading.value = true
        repository.updateEventGroups(tourId)
        //_loading.value = false
    }

    fun getToursForDate(): List<Tour> {
        return repository.getToursForDate(_displayDate.value)
    }
}
