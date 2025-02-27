package de.motis.prima

import androidx.compose.runtime.Composable
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import de.motis.prima.app.DriversApp
import de.motis.prima.services.CookieStore

@Composable
fun Nav() {
    val navController = rememberNavController()
    val userViewModel: UserViewModel = viewModel()
    val scanViewModel: ScanViewModel = viewModel()

    // Before rendering any component, check preconditions
    val startDestination by remember {
        derivedStateOf {
            val cookieStore = CookieStore(DriversApp.instance)
            if (cookieStore.isEmpty()) {
                "login"
            } else {
                "vehicles"
            }
        }
    }

    NavHost(navController = navController, startDestination = startDestination) {
        composable(route = "login") {
            Login(navController, userViewModel)
        }

        composable(route = "vehicles") {
            Vehicles(navController, userViewModel)
        }

        composable(route = "tours") {
            Tours(navController, userViewModel)
        }

        composable(route = "scan/{tourId}/{requestId}") {
            val tourId = it.arguments?.getString("tourId")?.toInt()
            val requestId = it.arguments?.getString("requestId")?.toInt()
            TicketScan(navController,  tourId!!, requestId!!, scanViewModel)
        }

        composable(route = "fare/{tourId}") {
            val tourId = it.arguments?.getString("tourId")?.toInt()
            Fare(navController, userViewModel, scanViewModel, tourId!!)
        }
    }
}
