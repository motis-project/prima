package de.motis.prima.viewmodel

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import de.motis.prima.data.DataRepository
import de.motis.prima.data.Ticket
import de.motis.prima.data.TourObject
import de.motis.prima.data.ValidationStatus
import de.motis.prima.formatTo
import de.motis.prima.services.ApiService
import de.motis.prima.services.Tour
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOn
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import retrofit2.Response
import java.time.LocalDate
import java.time.ZoneId
import java.util.Date
import javax.inject.Inject

@HiltViewModel
class ToursViewModel @Inject constructor(
    private val apiService: ApiService,
    private val repository: DataRepository
) : ViewModel() {

    //private val _toursCache = MutableStateFlow<List<Tour>>(emptyList())
    //var toursCache = _toursCache.asStateFlow()
    var toursCache = repository.toursCache

    private val _displayDate = MutableStateFlow(LocalDate.now())
    //val displayDate = _displayDate.asStateFlow()
    val displayDate = repository.displayDate

    //private val _toursForDate = MutableStateFlow<List<Tour>>(emptyList())
    //val toursForDate = _toursForDate.asStateFlow()
    val toursForDate = repository.toursForDate

    private val _loading = MutableStateFlow(false)
    val loading: StateFlow<Boolean> = _loading.asStateFlow()

    private val _networkError = MutableStateFlow(false)
    //val networkError = _networkError.asStateFlow()
    val networkError = repository.networkError

    var selectedVehicle = repository.selectedVehicle
        .stateIn(viewModelScope, SharingStarted.Eagerly, null)

    init {
        /*viewModelScope.launch {
            vehicleId = repository.selectedVehicle.first().id
            _toursForDate.value = repository.getToursForDate(_displayDate.value, vehicleId)
            startRefreshingTours()
        }*/
        startReporting()
    }

    /*private fun refreshTours(): Flow<Response<List<Tour>>> = flow {
        while (true) {
            val today = LocalDate.now()

            if (today == displayDate.value) {
                Log.d("refresh", "refresh")
                val tomorrow = today.plusDays(1)
                val start = today.atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()
                val end = tomorrow.atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()

                try {
                    val response = apiService.getTours(start, end)
                    emit(response)
                } catch (e: Exception) {
                    _networkError.value = true
                    val toursDate = repository.getToursForDate(_displayDate.value, vehicleId)
                    _toursForDate.value = toursDate
                }
                delay(10000) // 10 sec
            }
        }
    }.flowOn(Dispatchers.IO)

    private fun startRefreshingTours() {
        CoroutineScope(Dispatchers.IO).launch {
            refreshTours().collect { response ->
                if (response.isSuccessful) {
                    _networkError.value = false
                    val fetchedTours = response.body() ?: emptyList()

                    var tours = fetchedTours.filter { t -> t.vehicleId == vehicleId }
                    tours = tours.sortedBy { t -> t.events[0].scheduledTimeStart }

                    val toursDate = repository.getToursForDate(_displayDate.value, vehicleId)

                    if (tours.size > toursDate.size) {
                        val newItem = tours.last()
                        val pickup = newItem.events.first()
                        val currentDay = Date().formatTo("yyyy-MM-dd")
                        val pickupDate = Date(pickup.scheduledTimeStart)
                        val pickupDay = pickupDate.formatTo("yyyy-MM-dd")
                        val pickupTime = pickupDate.formatTo("HH:mm")

                        if (pickupDay == currentDay) {
                            repository.showNotification(
                                "Neue Fahrt",
                                "$pickupTime, ${pickup.address}"
                            )
                        }
                    }

                    repository.setTours(fetchedTours)
                    _toursCache.value = tours
                } else {
                    _networkError.value = true
                    Log.d("debug", "fetchTours: $response")
                }
            }
        }
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
                    _networkError.value = false
                    val fetchedTours = response.body() ?: emptyList()

                    var tours = fetchedTours.filter { t -> t.vehicleId == vehicleId }
                    tours = tours.sortedBy { t -> t.events[0].scheduledTimeStart }

                    _toursForDate.value = repository.getToursForDate(_displayDate.value, vehicleId)
                    _toursCache.value = tours

                    repository.setTours(fetchedTours)
                }
            } catch (e: Exception) {
                _networkError.value = true
                _toursForDate.value = repository.getToursForDate(_displayDate.value, vehicleId)
            }
        }
    }*/

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

    fun incrementDate() {
        /*_displayDate.value = _displayDate.value.plusDays(1)
        fetchTours()
        _toursForDate.value = getToursForDate()*/
        repository.incrementDate()
    }

    fun decrementDate() {
        /*_displayDate.value = _displayDate.value.minusDays(1)
        fetchTours()
        _toursForDate.value = getToursForDate()*/
        repository.decrementDate()
    }

    fun updateEventGroups(tourId: Int) {
        repository.updateEventGroups(tourId)
    }

    /*private fun getToursForDate(): List<Tour> {
        return repository.getToursForDate(_displayDate.value, repository.selectedVehicleId)
    }*/
}
