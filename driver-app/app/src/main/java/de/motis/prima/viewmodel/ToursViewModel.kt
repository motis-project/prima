package de.motis.prima.viewmodel

import android.util.Log
import androidx.compose.runtime.mutableIntStateOf
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import de.motis.prima.app.NotificationHelper
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
    private val repository: DataRepository,
    private val notificationHelper: NotificationHelper
) : ViewModel() {
    private val _toursCache = MutableStateFlow<List<Tour>>(emptyList())
    //val toursCache: StateFlow<List<Tour>> = _toursCache.asStateFlow()
    var toursCache = repository.toursCache

    private val _loading = MutableStateFlow(false)
    val loading: StateFlow<Boolean> = _loading.asStateFlow()

    private val _networkError = MutableStateFlow(false)
    val networkError = _networkError.asStateFlow()

    private val _displayDate = MutableStateFlow(LocalDate.now())
    val displayDate = _displayDate.asStateFlow()

    private var fetchAttempts = mutableIntStateOf(0)

    val selectedVehicle = repository.selectedVehicle
        .stateIn(viewModelScope, SharingStarted.Eagerly, null)

    val eventGroups = repository.eventGroups
    var initialFetch = false

    init {
        notificationHelper.createNotificationChannel()
        //startRefreshingTours()
        startReportingScans()
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
                    if (_toursCache.value != fetchedTours) {
                        fetchedTours.sortedBy { t -> t.events[0].scheduledTimeStart }
                        _toursCache.value = fetchedTours
                        //repository.setTours(fetchedTours)
                    }
                }
            } catch (e: Exception) {
                Log.e("error", "Exception: ${e.message}")
            }
        }
    }

    /*private fun startRefreshingTours() {
        initialFetch = true
        CoroutineScope(Dispatchers.IO).launch {
            refreshTours().collect { response ->
                if (response.isSuccessful) {
                    val fetchedTours = response.body() ?: emptyList()
                    fetchAttempts.intValue = 1
                    _networkError.value = false

                    if (fetchedTours.size > _toursCache.value.size) {
                        val newItem = fetchedTours.last()
                        val pickup = newItem.events.first()
                        val currentDay = Date().formatTo("yyyy-MM-dd")
                        val pickupDate = Date(pickup.scheduledTimeStart)
                        val pickupDay = pickupDate.formatTo("yyyy-MM-dd")
                        val pickupTime = pickupDate.formatTo("HH:mm")

                        if (pickupDay == currentDay && !initialFetch) {
                            Log.d("test", "noftify!")
                            sendNotification(
                                "Neue Fahrt",
                                "Um: $pickupTime in ${pickup.address}"
                            )
                        }
                    }

                    if (_toursCache.value != fetchedTours) {
                        fetchedTours.sortedBy { t -> t.events[0].scheduledTimeStart }
                        _toursCache.value = fetchedTours
                        repository.setTours(fetchedTours)
                    }
                } else {
                    _networkError.value = true
                    fetchAttempts.intValue++
                    Log.d("debug", "fetchTours: $response")
                }
                initialFetch = false
            }
        }
    }

    private fun refreshTours(): Flow<Response<List<Tour>>> = flow {
        while (true) {
            val displayDay = _displayDate.value
            val nextDay = displayDay.plusDays(1)
            val start = displayDay.atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()
            val end = nextDay.atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()

            try {
                val response = apiService.getTours(start, end)
                emit(response)
            } catch (e: Exception) {//TODO: first try? else: do not disturb
                /*fetchAttempts.intValue++
                if (fetchAttempts.intValue - 3 < 0) {
                    _loading.value = true
                }
                if (fetchAttempts.intValue > 3) {
                    _loading.value = false
                    _networkError.value = true
                }*/
                Log.e("error", "Exception: ${e.message}")
            }
            delay(10000) // 10 sec
        }
    }.flowOn(Dispatchers.IO)*/

    private fun sendNotification(title: String, msg: String) {
        notificationHelper.showNotification(title, msg)
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

    private fun startReportingScans() {
        viewModelScope.launch {
            while (true) {
                val failedReports = repository.getTicketsByValidationStatus(ValidationStatus.CHECKED_IN)
                Log.d("debug", "failedReports: $failedReports")
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
        _loading.value = true
        repository.updateEventGroups(tourId)
        _loading.value = false
    }
}
