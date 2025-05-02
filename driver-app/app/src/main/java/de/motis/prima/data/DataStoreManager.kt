package de.motis.prima.data

import android.annotation.SuppressLint
import android.content.Context
import android.devicelock.DeviceId
import android.provider.Settings
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import de.motis.prima.services.Vehicle
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import java.util.UUID

val Context.dataStore by preferencesDataStore(name = "settings")

data class DeviceInfo(
    val deviceId: String,
    val fcmToken: String,
    val tokenPending: Boolean
)

class DataStoreManager(private val context: Context) {
    companion object {
        private val SELECTED_VEHICLE_KEY = intPreferencesKey("selected_vehicle")
        private val LICENSE_PLATE_KEY = stringPreferencesKey("license_plate")
        private val FCM_TOKEN_KEY = stringPreferencesKey("fcm_token")
        private val DEVICE_ID_KEY = stringPreferencesKey("device_id")
        private val TOKEN_PENDING_KEY = booleanPreferencesKey("token_pending")
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

    val deviceInfoFlow: Flow<DeviceInfo> = context.dataStore.data
        .map { preferences ->
            DeviceInfo(
                preferences[DEVICE_ID_KEY] ?: "",
                preferences[FCM_TOKEN_KEY] ?: "",
                preferences[TOKEN_PENDING_KEY] ?: false
            )
        }

    suspend fun setDeviceInfo(token: String, pending: Boolean) {
        context.dataStore.edit { preferences ->
            preferences[DEVICE_ID_KEY] = getDeviceId()
            preferences[FCM_TOKEN_KEY] = token
            preferences[TOKEN_PENDING_KEY] = pending
        }
    }

    suspend fun resetTokenPending() {
        context.dataStore.edit { preferences ->
            preferences[TOKEN_PENDING_KEY] = false
        }
    }

    @SuppressLint("HardwareIds")
    private fun getDeviceId(): String {
        return Settings.Secure.getString(
            context.contentResolver,
            Settings.Secure.ANDROID_ID
        )?: UUID.randomUUID().toString()
    }
}