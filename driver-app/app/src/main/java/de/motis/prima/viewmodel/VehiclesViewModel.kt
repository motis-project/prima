package de.motis.prima.viewmodel

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import de.motis.prima.data.DataRepository
import de.motis.prima.services.ApiService
import de.motis.prima.services.Vehicle
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import javax.inject.Inject

@HiltViewModel
class VehiclesViewModel @Inject constructor(
    private val apiService: ApiService,
    private val repository: DataRepository
) : ViewModel() {
    private val _loading = MutableStateFlow(false)
    val loading: StateFlow<Boolean> = _loading.asStateFlow()

    private val _networkError = MutableStateFlow(false)
    val networkError = _networkError.asStateFlow()

    val vehicles = repository.vehicles

    init {
        viewModelScope.launch {
            _loading.value = true
            apiService.getVehicles().enqueue(object : Callback<List<Vehicle>> {
                override fun onResponse(
                    call: Call<List<Vehicle>>,
                    response: Response<List<Vehicle>>
                ) {
                    if (response.isSuccessful) {
                        repository.setVehicles(response.body() ?: emptyList())
                        _loading.value = false
                    } else {
                        Log.d("error", response.toString())
                    }
                }

                override fun onFailure(call: Call<List<Vehicle>>, t: Throwable) {
                    _networkError.value = true
                    _loading.value = false
                }
            })
        }
    }

    fun selectVehicle(id: Int) {
        viewModelScope.launch {
            repository.setSelectedVehicle(id)
        }
    }
}
