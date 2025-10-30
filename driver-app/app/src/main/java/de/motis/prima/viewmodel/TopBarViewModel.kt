package de.motis.prima.viewmodel

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import de.motis.prima.data.CookieStore
import de.motis.prima.data.DataRepository
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class TopBarViewModel @Inject constructor(
    private val cookieStore: CookieStore,
    private val repository: DataRepository
) : ViewModel() {
    private val _logoutEvent = MutableSharedFlow<Unit>()
    val logoutEvent = _logoutEvent.asSharedFlow()

    fun logout() {
        viewModelScope.launch {
            try {
                cookieStore.clearCookies()
                repository.stopFetchingTours()
                repository.removeFirebaseToken()
                _logoutEvent.emit(Unit)
            } catch (e: Exception) {
                Log.d("error", "Error while logout.")
            }
        }
    }

    fun toggleTheme() {
        repository.toggleTheme()
    }
}
