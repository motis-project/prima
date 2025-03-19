package de.motis.prima.viewmodel

import androidx.compose.runtime.collectAsState
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import de.motis.prima.data.DataRepository
import de.motis.prima.data.TourDTO
import de.motis.prima.data.TourObject
import de.motis.prima.services.ApiService
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class FareViewModel @Inject constructor(
    private val apiService: ApiService,
    private val repository: DataRepository
) : ViewModel() {
    private val _networkErrorEvent = MutableSharedFlow<Unit>()
    val networkErrorEvent = _networkErrorEvent.asSharedFlow()

    private val _conversionErrorEvent = MutableSharedFlow<Unit>()
    val conversionErrorEvent = _conversionErrorEvent.asSharedFlow()

    private val _reportSuccessEvent = MutableSharedFlow<Unit>()
    val reportSuccessEvent = _reportSuccessEvent.asSharedFlow()

    val scannedTickets = repository.storedTickets
    val storedTours = repository.storedTours

    fun reportFare(tourId: Int, fare: String) {
        viewModelScope.launch {
            var fareCent = 0
            try {
                fareCent = fare.replace(",", "").toInt()
            } catch (e: Exception) {
                _conversionErrorEvent.emit(Unit)
            }

            if (fareCent > 0) {
                var fareReported = false
                try {
                    val response = apiService.reportFare(tourId, fareCent)
                    if (response.isSuccessful) {
                        fareReported = true
                        _reportSuccessEvent.emit(Unit)
                    }
                } catch (e: Exception) {
                    fareReported = false
                    _networkErrorEvent.emit(Unit)
                } finally {
                    repository.updateTourStore(
                        TourDTO(tourId, false, fareCent, fareReported)
                    )
                }
            }
        }
    }
}
