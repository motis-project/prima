package de.motis.prima.data

import kotlinx.coroutines.flow.Flow
import javax.inject.Inject

class UserPreferencesRepository @Inject constructor(
    private val dataStoreManager: DataStoreManager
) {
    val isDarkMode: Flow<Boolean> = dataStoreManager.darkModeFlow

    suspend fun setDarkMode(enabled: Boolean) {
        dataStoreManager.setDarkMode(enabled)
    }
}
