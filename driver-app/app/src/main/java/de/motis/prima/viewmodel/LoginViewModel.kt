package de.motis.prima.viewmodel

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import de.motis.prima.data.CookieStore
import de.motis.prima.data.DataRepository
import de.motis.prima.data.DeviceInfo
import de.motis.prima.services.ApiService
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
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

    private val _unknownErrorEvent = MutableSharedFlow<Boolean>()
    val unknownErrorEvent = _unknownErrorEvent.asSharedFlow()

    val deviceInfo = repository.deviceInfo
    private val _deviceInfo = MutableStateFlow(DeviceInfo("", "", false))

    val selectedVehicle = repository.selectedVehicle

    init {
        viewModelScope.launch {
            repository.deviceInfo.collect {value -> _deviceInfo.value = value}
        }
    }

    fun isLoggedIn(): Boolean {
        return !cookieStore.isEmpty()
    }

    private fun logout() {
        viewModelScope.launch {
            try {
                cookieStore.clearCookies()
                repository.stopFetchingTours()
                repository.removeFirebaseToken()
            } catch (e: Exception) {
                Log.d("error", "Error while logout.")
            }
        }
    }

    private suspend fun fcmToken() {
        try {
            val resFCM = apiService
                .sendDeviceInfo(_deviceInfo.value.deviceId, _deviceInfo.value.fcmToken)
            Log.d("fcm", "$resFCM")
            if (resFCM.isSuccessful) {
                repository.startRefreshingTours()
                repository.resetTokenPending()
                _navigationEvent.emit(true)
                Log.d("login", "User has companyID, fcmToken updated")
            } else if (resFCM.code() == 403) {
                logout()
                _accountErrorEvent.emit(true)
                Log.d("login", "No companyID: login rejected")
            } else if (resFCM.code() == 400) {
                repository.fetchFirebaseToken()
                _navigationEvent.emit(true)
                Log.d("login", "Stored  fcmToken was invalid: tried to refresh")
            }
        } catch (e: Exception) {
            Log.e("error", "${e.message}")
        } finally { // TODO: tmp
            _navigationEvent.emit(true)
        }
    }

    fun login(email: String, password: String) {
        viewModelScope.launch {
            try {
                val resLogin = apiService.login(email, password)
                if (resLogin.isSuccessful) {
                    Log.d("login", "Authentication succeeded")
                    fcmToken()
                } else {
                    if (resLogin.code() == 400) {
                        Log.e("login", "Wrong credentials. Login request rejected by backend")
                        _loginErrorEvent.emit(true)
                    } else if (resLogin.code() == 403) {
                        Log.e("login", "Missing company-ID. Login request rejected by backend")
                        _accountErrorEvent.emit(true)
                    } else {
                        Log.e("login", "Login request rejected for unknown reason")
                        _unknownErrorEvent.emit(true)
                    }
                }
            } catch (e: Exception) {
                _networkErrorEvent.emit(Unit)
                Log.e("login", "Network error during login")
            }
        }
    }

    fun sendDeviceInfo(deviceId: String, token: String) {
        viewModelScope.launch {
            try {
                val response = apiService.sendDeviceInfo(deviceId, token)
                if (response.isSuccessful) {
                    repository.resetTokenPending()
                    Log.d("fcm", "Token was sent to backend")
                } else {
                    Log.e("fcm", "Failed to send token to backend")
                }
            } catch (e: Exception) {
                _networkErrorEvent.emit(Unit)
                Log.e("fcm", "Network error while trying to send token")
            }
        }
    }
}
