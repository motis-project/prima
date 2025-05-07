package de.motis.prima

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
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import de.motis.prima.data.DeviceInfo
import de.motis.prima.viewmodel.LoginViewModel
import de.motis.prima.viewmodel.SettingsViewModel

@Composable
fun Nav(intent: Intent?) {
    val navController = rememberNavController()
    val loginViewModel: LoginViewModel = hiltViewModel()
    val settingsViewModel: SettingsViewModel = hiltViewModel()

    val selectedVehicle = settingsViewModel.selectedVehicle.collectAsState().value
    val loggedIn = loginViewModel.isLoggedIn()

    if (selectedVehicle == null) {
        LoadingScreen()
    } else {
        val startDestination = if (!loggedIn) {
            "login"
        } else {
            if (selectedVehicle.id == 0) {
                "vehicles"
            } else {
                "tours"
            }
        }

        if (intent != null) {
            Log.d("intent", "Nav:  ${intent.getStringExtra("tourId")}")
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
        }
    }
}

@Composable
fun LoadingScreen() {
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        CircularProgressIndicator()
    }
}
