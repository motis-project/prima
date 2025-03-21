package de.motis.prima.data

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import de.motis.prima.services.Vehicle
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

val Context.dataStore by preferencesDataStore(name = "settings")

class DataStoreManager(private val context: Context) {
    companion object {
        private val SELECTED_VEHICLE_KEY = intPreferencesKey("selected_vehicle")
        private val LICENSE_PLATE_KEY = stringPreferencesKey("license_plate")
    }

    val selectedVehicleFlow: Flow<Vehicle> = context.dataStore.data
        .map { preferences ->
            Vehicle(
                preferences[SELECTED_VEHICLE_KEY] ?: 0,
                preferences[LICENSE_PLATE_KEY] ?: ""
            )
        }

    suspend fun setSelectedVehicle(vehicle: Vehicle) {
        context.dataStore.edit { preferences ->
            preferences[SELECTED_VEHICLE_KEY] = vehicle.id
            preferences[LICENSE_PLATE_KEY] = vehicle.licensePlate
        }
    }
}