package de.motis.prima.data

import android.content.Context
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import de.motis.prima.services.CookieStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

val Context.dataStore by preferencesDataStore(name = "settings")

class DataStoreManager(private val context: Context) {
    private val cookieStore: CookieStore = CookieStore(context)

    fun clearCookies() {
        cookieStore.clearCookies()
    }

    companion object {
        private val DARK_MODE_KEY = booleanPreferencesKey("dark_mode")
        private val SELECTED_VEHICLE_KEY = intPreferencesKey("selected_vehicle")
    }

    val darkModeFlow: Flow<Boolean> = context.dataStore.data
        .map { preferences -> preferences[DARK_MODE_KEY] ?: false }

    suspend fun setDarkMode(enabled: Boolean) {
        context.dataStore.edit { preferences ->
            preferences[DARK_MODE_KEY] = enabled
        }
    }

    val selectedVehicleFlow: Flow<Int> = context.dataStore.data
        .map { preferences -> preferences[SELECTED_VEHICLE_KEY] ?: 0 }

    suspend fun setSelectedVehicle(id: Int) {
        context.dataStore.edit { preferences ->
            preferences[SELECTED_VEHICLE_KEY] = id
        }
    }
}