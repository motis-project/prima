package de.motis.prima.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import de.motis.prima.data.DataRepository
import de.motis.prima.services.ApiService
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class LoginViewModel @Inject constructor(
    private val apiService: ApiService,
    repository: DataRepository
) : ViewModel() {
    private val _navigationEvent = MutableSharedFlow<Boolean>()
    val navigationEvent = _navigationEvent.asSharedFlow()

    private val _loginErrorEvent = MutableSharedFlow<Boolean>()
    val loginErrorEvent = _loginErrorEvent.asSharedFlow()

    private val _networkErrorEvent = MutableSharedFlow<Unit>()
    val networkErrorEvent = _networkErrorEvent.asSharedFlow()

    fun login(email: String, password: String) {
        viewModelScope.launch {
            try {
                val response = apiService.login(email, password)
                if (response.code() == 302) {
                    _navigationEvent.emit(true)
                } else {
                    _loginErrorEvent.emit(true)
                }
            } catch (e: Exception) {
                _networkErrorEvent.emit(Unit)
            }
        }
    }

    val selectedVehicle = repository.selectedVehicle
}
