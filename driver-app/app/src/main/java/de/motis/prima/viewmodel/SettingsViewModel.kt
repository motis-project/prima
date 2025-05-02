package de.motis.prima.viewmodel

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import de.motis.prima.data.DataRepository
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class SettingsViewModel @Inject constructor(
    repository: DataRepository
) : ViewModel() {
    val selectedVehicle = repository.selectedVehicle
        .stateIn(viewModelScope, SharingStarted.Eagerly, null)
}
