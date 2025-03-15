package de.motis.prima.viewmodel

import android.util.Log
import androidx.compose.runtime.mutableIntStateOf
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import de.motis.prima.data.DataRepository
import de.motis.prima.data.Ticket
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
    private val _tours = MutableStateFlow<List<Tour>>(emptyList())
    val tours: StateFlow<List<Tour>> = _tours.asStateFlow()

    private val _loading = MutableStateFlow(false)
    val loading: StateFlow<Boolean> = _loading.asStateFlow()

    private val _networkError = MutableStateFlow(false)
    val networkError = _networkError.asStateFlow()

    private val _displayDate = MutableStateFlow(LocalDate.now())
    val displayDate = _displayDate.asStateFlow()

    private var fetchAttempts = mutableIntStateOf(0)

    val selectedVehicle = repository.selectedVehicle
        .stateIn(viewModelScope, SharingStarted.Eagerly, null)

    private val scannedTickets = repository.scannedTickets

    init {
        startFetchingTours()
        startReportingScans()
    }

    private fun refreshTours() {
        val displayDay = _displayDate.value
        val nextDay = displayDay.plusDays(1)
        val start = displayDay.atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()
        val end = nextDay.atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()

        viewModelScope.launch {
            try {
                _loading.value = true
                val response = apiService.getTours(start, end)
                if (response.isSuccessful) {
                    _tours.value = response.body() ?: emptyList()
                    _loading.value = false
                    repository.setTours(_tours.value)
                }
            } catch (e: Exception) {
                Log.e("error", "Exception: ${e.message}")
            }
        }
    }

    private fun fetchTours(): Flow<Response<List<Tour>>> = flow {
        while (true) {
            val displayDay = _displayDate.value
            val nextDay = displayDay.plusDays(1)
            val start = displayDay.atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()
            val end = nextDay.atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()

            try {
                val response = apiService.getTours(start, end)
                emit(response)
            } catch (e: Exception) {
                fetchAttempts.intValue++
                if (fetchAttempts.intValue - 3 < 0) {
                    _loading.value = true
                }
                if (fetchAttempts.intValue > 3) {
                    _loading.value = false
                    _networkError.value = true
                }
                Log.e("error", "Exception: ${e.message}")
            }
            delay(10000) // 10 sec
        }
    }.flowOn(Dispatchers.IO)

    private fun startFetchingTours() {
        CoroutineScope(Dispatchers.IO).launch {
            fetchTours().collect { response ->
                if (response.isSuccessful) {
                    val newTours = response.body() ?: emptyList()
                    fetchAttempts.intValue = 1
                    _loading.value = false
                    _networkError.value = false

                    if (tours.value.isNotEmpty() && newTours.size > tours.value.size) {
                        val newItem = newTours.last()
                        val pickup = newItem.events.first()
                        val currentDay = Date().formatTo("yyyy-MM-dd")
                        val pickupDate = Date(pickup.scheduledTimeStart)

                        if (pickupDate.formatTo("yyyy-MM-dd") == currentDay) {
                            // TODO: notifications
                        }
                    }
                    _tours.value = newTours
                    repository.setTours(newTours)
                } else {
                    Log.d("debug", "fetchTours: $response")
                }
            }
        }
    }

    private fun retryFailedReport(ticket: Ticket) {
        viewModelScope.launch {
            try {
                val response = apiService.validateTicket(ticket.requestId, ticket.ticketCode)
                if (response.isSuccessful) {
                    ticket.validationStatus = ValidationStatus.OK
                    repository.updateScannedTickets(ticket)
                } else {
                    ticket.validationStatus = ValidationStatus.REJECTED
                    repository.updateScannedTickets(ticket)
                }
            } catch (e: Exception) {
                Log.d("error", "Network Error: ${e.message!!}")
            }
        }
    }

    private fun startReportingScans() {
        viewModelScope.launch {
            while (true) {
                val failedReports = scannedTickets.value.entries
                    .filter { e -> e.value.validationStatus == ValidationStatus.FAILED }
                Log.d("debug", "failedReports: $failedReports")
                for (report in failedReports) {
                    retryFailedReport(report.value)
                }
                delay(120000) // 2 min
            }
        }
    }

    fun incrementDate() {
        _displayDate.value = _displayDate.value.plusDays(1)
        refreshTours()
    }

    fun decrementDate() {
        _displayDate.value = _displayDate.value.minusDays(1)
        refreshTours()
    }

    fun selectTour(id: Int) {
        repository.setSelectedTourId(id)
        repository.updateEventGroups()
    }
}
