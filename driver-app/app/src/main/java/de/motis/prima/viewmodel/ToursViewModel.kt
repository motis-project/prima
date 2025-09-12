package de.motis.prima.viewmodel

import android.annotation.SuppressLint
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
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class ToursViewModel @Inject constructor(
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
        resetDate()
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

    @SuppressLint("DefaultLocale")
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
