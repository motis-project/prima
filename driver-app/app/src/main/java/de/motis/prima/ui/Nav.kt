package de.motis.prima.ui

import android.content.Intent
import android.util.Log
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import dagger.hilt.android.lifecycle.HiltViewModel
import de.motis.prima.data.DataRepository
import de.motis.prima.data.DeviceInfo
import de.motis.prima.viewmodel.LoginViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.stateIn
import javax.inject.Inject

@HiltViewModel
class NavViewModel @Inject constructor(
    private val repository: DataRepository
) : ViewModel() {
    val selectedVehicle = repository.selectedVehicle
        .stateIn(viewModelScope, SharingStarted.Eagerly, null)

    init {
        repository.updateVehicles()
    }

    fun fetchTours(pickupTime: Long?) {
        repository.fetchTours(pickupTime)
    }
}

@Composable
fun Nav(intent: Intent?, viewModel: NavViewModel = hiltViewModel()) {
    val navController = rememberNavController()
    val loginViewModel: LoginViewModel = hiltViewModel()
    val selectedVehicle = viewModel.selectedVehicle.collectAsState().value
    val loggedIn = loginViewModel.isLoggedIn()

    var notifiedTourId = -1
    intent?.let { safeIntent ->
        runCatching {
            val tourIdStr = safeIntent.getStringExtra("tourId")
            val pickupTime = safeIntent.getStringExtra("pickupTime")

            viewModel.fetchTours(pickupTime?.toLong())

            tourIdStr?.let { safeTourIdStr ->
                notifiedTourId = safeTourIdStr.toInt()
            }
        }
    }

    if (selectedVehicle == null) {
        LoadingScreen()
    } else {
        val startDestination = if (!loggedIn) {
            "login"
        } else {
            if (notifiedTourId != -1) {
                "preview/${notifiedTourId}"
            }
            else if (selectedVehicle.id == 0) {
                "vehicles"
            } else {
                "tours"
            }
        }

        val deviceInfo by loginViewModel.deviceInfo.collectAsState(DeviceInfo("", "", false))
        if (loggedIn && deviceInfo.tokenPending) {
            loginViewModel.sendDeviceInfo(deviceInfo.deviceId, deviceInfo.fcmToken)
        }

        NavHost(navController = navController, startDestination = startDestination) {
            composable(route = "login") {
                Login(navController)
            }

            composable(route = "vehicles") {
                Vehicles(navController)
            }

            composable(route = "tours") {
                Tours(navController, intent)
            }

            composable(route = "preview/{tourId}") {
                val tourId = it.arguments?.getString("tourId")?.toInt()
                TourPreview(navController, tourId!!)
            }

            composable(route = "leg/{tourId}/{eventGroupIndex}") {
                val tourId = it.arguments?.getString("tourId")?.toInt()
                val eventGroupIndex = it.arguments?.getString("eventGroupIndex")?.toInt()
                Leg(navController, tourId!!, eventGroupIndex!!)
            }

            composable(route = "scan/{eventGroupId}") {
                val eventGroupId = it.arguments?.getString("eventGroupId")
                TicketScan(navController, eventGroupId!!)
            }

            composable(route = "fare/{tourId}") {
                val tourId = it.arguments?.getString("tourId")?.toInt()
                Fare(navController, tourId!!)
            }

            composable(route = "availability") {
                Availability(navController)
            }

            composable(route = "itinerary/{requestId}") {
                val requestId = it.arguments?.getString("requestId")?.toInt()
                ItineraryScreen(navController, requestId!!)
            }
        }
    }
}

@Composable
fun LoadingScreen() {
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        CircularProgressIndicator()
    }
}
