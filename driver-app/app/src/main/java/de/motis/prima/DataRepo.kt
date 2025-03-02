package de.motis.prima

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import de.motis.prima.app.DriversApp
import de.motis.prima.services.Vehicle
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map

/*class DataRepository {
    private val _data = MutableStateFlow("Initial Data")
    val data: StateFlow<String> = _data

    fun setData(newValue: String) {
        _data.value = newValue
    }

    private val Context.dataStore by preferencesDataStore(name = "prima_datastore")
    private val vehicleId_KEY = intPreferencesKey("vehicleId")
    private val licensePlate_KEY = stringPreferencesKey("licensePlate")

    var selectedVehicle = DriversApp.instance.dataStore.data.map { preferences ->
        Vehicle(
            preferences[vehicleId_KEY] ?: 0,
            preferences[licensePlate_KEY] ?: "-",
        )
    }

    suspend fun saveToDataStore(vehicle: Vehicle) {
        DriversApp.instance.dataStore.edit { preferences ->
            preferences[vehicleId_KEY] = vehicle.id
            preferences[licensePlate_KEY] = vehicle.licensePlate
        }
    }
}*/