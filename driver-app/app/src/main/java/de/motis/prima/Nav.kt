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
    val scanViewModel: ScanViewModel = viewModel()
    val userViewModel: UserViewModel = viewModel()

    // Before rendering any component, check whether user is authenticated.
    val startDestination by remember {
        derivedStateOf {
            val cookieStore = CookieStore(DriversApp.instance)
            if (cookieStore.isEmpty()) {
                Log.d("Cookie", "No Cookie found. Navigating to Login.")
                "login"
            } else {
                Log.d("Cookie", "Cookie found. Navigating to Journeys.")
                "vehicles"
            }
        }
    }

    NavHost(navController = navController, startDestination = startDestination) {
        composable(route = "login") {
            Login(navController, vehiclesViewModel, toursViewModel)
        }

        composable(route = "vehicles") {
            Vehicles(navController, vehiclesViewModel, toursViewModel)
        }

        composable(route = "tours") {
            Tours(navController, vehiclesViewModel, toursViewModel, userViewModel)
        }

        composable(route = "tour/{tourId}") {
            val tourId = it.arguments?.getString("tourId")?.toInt()
            var tour = toursViewModel.tours.value.find { tour -> tour.tourId == tourId }
            TourPreview(navController, userViewModel, TourViewModel(tour!!))
        }

        composable(route = "legs/{tourId}/{eventGroupIndex}") {
            val tourId = it.arguments?.getString("tourId")?.toInt()
            val stopIndex = it.arguments?.getString("eventGroupIndex")?.toInt()
            var tour = toursViewModel.tours.value.find { tour -> tour.tourId == tourId }
            Leg(stopIndex!!, TourViewModel(tour!!), userViewModel, scanViewModel, navController)
        }

        composable(route = "scan/{tourId}/{eventIndex}") {
            val tourId = it.arguments?.getString("tourId")?.toInt()
            val eventIndex = it.arguments?.getString("eventIndex")?.toInt()
            ScanTicket(navController,  tourId!!, eventIndex!!, scanViewModel)
        }

        composable(route = "taxameter/{tourId}") {
            val tourId = it.arguments?.getString("tourId")?.toInt()
            Taxameter(navController, toursViewModel, userViewModel, tourId!!)
        }
    }
}
