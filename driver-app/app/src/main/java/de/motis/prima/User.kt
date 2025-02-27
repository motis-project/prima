package de.motis.prima

import android.content.Context
import android.util.Log
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import de.motis.prima.app.DriversApp
import de.motis.prima.services.CookieStore
import de.motis.prima.services.Vehicle
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class UserViewModel : ViewModel() {
    private val cookieStore: CookieStore = CookieStore(DriversApp.instance)

    private val _logoutEvent = MutableSharedFlow<Unit>()
    val logoutEvent = _logoutEvent.asSharedFlow()

    private val _vehicleSelectEvent = MutableSharedFlow<Unit>()
    val vehicleSelectEvent = _vehicleSelectEvent.asSharedFlow()

    fun selectVehicle(vehicle: Vehicle) {
        viewModelScope.launch {
            try {
                saveToDataStore(vehicle)
                _vehicleSelectEvent.emit(Unit)
            } catch (e: Exception) {
                Log.d("error", "Error while vehicleSelect.")
            }
        }
    }

    private val Context.dataStore by preferencesDataStore(name = "prima_datastore")
    private val vehicleId_KEY = intPreferencesKey("vehicleId")
    private val licensePlate_KEY = stringPreferencesKey("licensePlate")

    var selectedVehicle = DriversApp.instance.dataStore.data.map { preferences ->
        Vehicle(
            preferences[vehicleId_KEY] ?: 0,
            preferences[licensePlate_KEY] ?: "-",
        )
    }.stateIn(
        viewModelScope,
        SharingStarted.Eagerly,
        Vehicle(0, "-")
    )

    private suspend fun saveToDataStore(vehicle: Vehicle) {
        DriversApp.instance.dataStore.edit { preferences ->
            preferences[vehicleId_KEY] = vehicle.id
            preferences[licensePlate_KEY] = vehicle.licensePlate
        }
    }

    fun logout() {
        viewModelScope.launch {
            try {
                cookieStore.clearCookies()
                _logoutEvent.emit(Unit)
            } catch (e: Exception) {
                Log.d("error", "Error while logout.")
            }
        }
    }
}