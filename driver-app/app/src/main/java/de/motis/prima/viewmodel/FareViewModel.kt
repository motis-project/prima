package de.motis.prima.viewmodel

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import de.motis.prima.data.DataRepository
import de.motis.prima.services.ApiService
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class FareViewModel @Inject constructor(
    private val apiService: ApiService,
    repository: DataRepository
) : ViewModel() {
    private val _networkErrorEvent = MutableSharedFlow<Unit>()
    val networkErrorEvent = _networkErrorEvent.asSharedFlow()

    private val _conversionErrorEvent = MutableSharedFlow<Unit>()
    val conversionErrorEvent = _conversionErrorEvent.asSharedFlow()

    private val _reportSuccessEvent = MutableSharedFlow<Unit>()
    val reportSuccessEvent = _reportSuccessEvent.asSharedFlow()

    val scannedTickets = repository.scannedTickets

    fun reportFare(tourId: Int, fare: String) {
        Log.d("debug", "$tourId, $fare")
        viewModelScope.launch {
            var fareCent = 0
            try {
                fareCent = fare.replace(",", "").toInt()
            } catch (e: Exception) {
                _conversionErrorEvent.emit(Unit)
            }

            if (fareCent > 0) {
                try {
                    val response = apiService.reportFare(tourId, fareCent)
                    if (response.isSuccessful) {
                        _reportSuccessEvent.emit(Unit)
                    }
                } catch (e: Exception) {
                    _networkErrorEvent.emit(Unit)
                }
            }
        }
    }
}
