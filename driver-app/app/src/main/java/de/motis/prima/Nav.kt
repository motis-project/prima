package de.motis.prima

import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import de.motis.prima.services.CookieStore
import de.motis.prima.viewmodel.SettingsViewModel

@Composable
fun Nav() {
    val navController = rememberNavController()
    val context = LocalContext.current
    val settingsViewModel: SettingsViewModel = hiltViewModel()
    val selectedVehicle = settingsViewModel.selectedVehicle.collectAsState(0)

    val startDestination by remember {
        derivedStateOf {
            val cookieStore = CookieStore(context)
            if (cookieStore.isEmpty()) {
                "login"
            } else {
                if (selectedVehicle.value != 0) {
                    "tours"
                } else {
                    "vehicles"
                }
            }
        }
    }

    NavHost(navController = navController, startDestination = startDestination) {
        composable(route = "login") {
            Login(navController)
        }

        composable(route = "vehicles") {
            Vehicles(navController)
        }

        composable(route = "tours") {
            Tours(navController)
        }

        composable(route = "scan/{tourId}/{requestId}") {
            val tourId = it.arguments?.getString("tourId")?.toInt()
            val requestId = it.arguments?.getString("requestId")?.toInt()
            TicketScan(navController, tourId!!, requestId!!)
        }

        composable(route = "fare/{tourId}") {
            val tourId = it.arguments?.getString("tourId")?.toInt()
            Fare(navController, tourId!!)
        }
    }
}
