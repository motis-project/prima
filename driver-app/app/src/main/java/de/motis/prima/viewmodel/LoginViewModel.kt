package de.motis.prima.viewmodel

import android.util.Log
import androidx.compose.runtime.collectAsState
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

    fun login(email: String, password: String) {
        viewModelScope.launch {
            try {
                val resLogin = apiService.login(email, password)
                if (resLogin.isSuccessful) {
                    Log.d("login", "Authentication succeeded")
                    val resFCM = apiService
                        .sendDeviceInfo(_deviceInfo.value.deviceId, _deviceInfo.value.fcmToken)
                    if (resFCM.isSuccessful) {
                        repository.startRefreshingTours()
                        repository.resetTokenPending()
                        _navigationEvent.emit(true)
                        Log.d("login", "User has companyID, fcmToken updated")
                    } else if (resFCM.code() == 403) {
                        _accountErrorEvent.emit(true)
                        logout()
                        Log.d("login", "No companyID: login rejected")
                    } else if (resFCM.code() == 400) {
                        repository.fetchFirebaseToken()
                        _navigationEvent.emit(true)
                        Log.d("login", "Stored  fcmToken was invalid: tried to refresh")
                    }
                } else {
                    _loginErrorEvent.emit(true)
                    Log.e("login", "Login request rejected by backend")
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
