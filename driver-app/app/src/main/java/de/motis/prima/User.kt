package de.motis.prima

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import de.motis.prima.app.DriversApp
import de.motis.prima.services.CookieStore
import de.motis.prima.services.Vehicle
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import dagger.hilt.android.lifecycle.HiltViewModel
import de.motis.prima.data.UserPreferencesRepository
import javax.inject.Inject

class UserViewModel: ViewModel() {
    //private val cookieStore: CookieStore = CookieStore(DriversApp.instance) // TODO

    private val _logoutEvent = MutableSharedFlow<Unit>()
    val logoutEvent = _logoutEvent.asSharedFlow()

    private val _vehicleSelectEvent = MutableSharedFlow<Unit>()
    val vehicleSelectEvent = _vehicleSelectEvent.asSharedFlow()

    /*val selectedVehicle = repository.selectedVehicle
        .stateIn(
            viewModelScope,
            SharingStarted.Eagerly,
            Vehicle(0, "-")
        )

    fun selectVehicle(vehicle: Vehicle) {
        viewModelScope.launch {
            try {
                repository.saveToDataStore(vehicle)
                _vehicleSelectEvent.emit(Unit)
            } catch (e: Exception) {
                Log.d("error", "Error while vehicleSelect.")
            }
        }
    }*/

    fun logout() {
        viewModelScope.launch {
            try {
                //cookieStore.clearCookies() //TODO
                _logoutEvent.emit(Unit)
            } catch (e: Exception) {
                Log.d("error", "Error while logout.")
            }
        }
    }
}
