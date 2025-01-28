package de.motis.prima

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import de.motis.prima.app.DriversApp
import de.motis.prima.services.CookieStore
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.launch

class UserViewModel : ViewModel() {
    private val cookieStore: CookieStore = CookieStore(DriversApp.instance)
    private val _logoutEvent = MutableSharedFlow<Unit>()
    val logoutEvent = _logoutEvent.asSharedFlow()

    fun logout() {
        viewModelScope.launch {
            try {
                cookieStore.clearCookies()
                _logoutEvent.emit(Unit)
            } catch (e: Exception) {
                Log.d("Logout", "Error while logout.")
            }
        }
    }
}