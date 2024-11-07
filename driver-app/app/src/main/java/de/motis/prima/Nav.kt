package de.motis.prima

import android.util.Log
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
    val vehiclesViewModel: VehiclesViewModel = viewModel()
    val toursViewModel: ToursViewModel = viewModel()

    // Before rendering any component, check whether user is authenticated.
    val startDestination by remember {
        derivedStateOf {
            val cookieStore = CookieStore(DriversApp.instance)
            if (cookieStore.isEmpty()) {
                Log.d("Cookie", "No Cookie found. Navigating to Login.")
                "login"
            } else {
                Log.d("Cookie", "Cookie found. Navigating to Journeys.")
                if (vehiclesViewModel.selectedVehicleId == 0) {
                    "vehicles"
                } else {
                    "tours"
                }
            }
        }
    }

    NavHost(navController = navController, startDestination = startDestination) {

        composable(route = "login") {
            Login(navController, vehiclesViewModel)
        }

        composable(route = "home") {
            Home(navController, vehiclesViewModel)
        }

        composable(route = "vehicles") {
            Vehicles(navController, vehiclesViewModel)
        }

        composable(route = "tours") {
            Tours(navController, vehiclesViewModel, toursViewModel)
        }

        composable(route = "taxameter") {
            Taxameter(navController, toursViewModel)
        }

        composable(route = "overview") {
            TourOverview(navController)
        }


        composable(route = "legs/{tourId}/{eventIndex}") {
            val tourId = it.arguments?.getString("tourId")?.toInt()
            val eventIndex = it.arguments?.getString("eventIndex")?.toInt()
            TourDetail(navController,  tourId!!, eventIndex!!, toursViewModel)
        }
    }
}
