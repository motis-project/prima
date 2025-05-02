package de.motis.prima.viewmodel

import android.util.Log
import androidx.compose.runtime.collectAsState
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import de.motis.prima.data.CookieStore
import de.motis.prima.data.DataRepository
import de.motis.prima.services.ApiService
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class LoginViewModel @Inject constructor(
    private val apiService: ApiService,
    private val repository: DataRepository,
    private val cookieStore: CookieStore
) : ViewModel() {
    private val _navigationEvent = MutableSharedFlow<Boolean>()
    val navigationEvent = _navigationEvent.asSharedFlow()

    private val _loginErrorEvent = MutableSharedFlow<Boolean>()
    val loginErrorEvent = _loginErrorEvent.asSharedFlow()

    private val _networkErrorEvent = MutableSharedFlow<Unit>()
    val networkErrorEvent = _networkErrorEvent.asSharedFlow()

    private val _accountErrorEvent = MutableSharedFlow<Boolean>()
    val accountErrorEvent = _accountErrorEvent.asSharedFlow()

    val selectedVehicle = repository.selectedVehicle
    val deviceInfo = repository.deviceInfo

    fun isLoggedIn(): Boolean {
        return !cookieStore.isEmpty()
    }

    private fun logout() {
        viewModelScope.launch {
            try {
                cookieStore.clearCookies()
            } catch (e: Exception) {
                Log.d("error", "Error while logout.")
            }
        }
    }

    fun login(email: String, password: String) {
        viewModelScope.launch {
            try {
                val response = apiService.login(email, password)
                Log.d("login", "$response")
                if (response.isSuccessful) {
                    val r = apiService.validateTicket(0, "")
                    if (r.code() == 404) {
                        _navigationEvent.emit(true)
                    } else {
                        logout()
                        _accountErrorEvent.emit(true)
                    }
                } else {
                    _loginErrorEvent.emit(true)
                }
            } catch (e: Exception) {
                _networkErrorEvent.emit(Unit)
            }
        }
    }

    fun sendDeviceInfo(deviceId: String, token: String) {
        viewModelScope.launch {
            try {
                Log.d("fcm", "Sending token: $token")
                val response = apiService.sendDeviceInfo(deviceId, token)
                Log.d("fcm", "$response")
                if (response.isSuccessful) {
                    repository.resetTokenPending()
                    Log.d("fcm", "Token sent.")
                }
            } catch (e: Exception) {
                _networkErrorEvent.emit(Unit)
            }
        }
    }
}
