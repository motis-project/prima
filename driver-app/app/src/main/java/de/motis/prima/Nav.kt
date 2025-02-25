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
fun Nav(
    cameraGranted: Boolean,
    fineLocationGranted: Boolean
) {
    val navController = rememberNavController()
    val userViewModel: UserViewModel = viewModel()
    val scanViewModel: ScanViewModel = viewModel()

    // Before rendering any component, check preconditions
    val startDestination by remember {
        derivedStateOf {
            val cookieStore = CookieStore(DriversApp.instance)
            if (!cameraGranted || !fineLocationGranted) {
                "permissionInfo"
            } else if (cookieStore.isEmpty()) {
                "login"
            } else {
                "vehicles"
            }
        }
    }

    NavHost(navController = navController, startDestination = startDestination) {
        composable(route = "permissionInfo") {
            PermissionInfo(navController, cameraGranted, fineLocationGranted)
        }

        composable(route = "login") {
            Login(navController, userViewModel)
        }

        composable(route = "vehicles") {
            Vehicles(navController, userViewModel)
        }

        composable(route = "tours") {
            Tours(navController, userViewModel)
        }

        composable(route = "scan/{tourId}") {
            val tourId = it.arguments?.getString("tourId")?.toInt()
            TicketScan(navController,  tourId!!, scanViewModel)
        }

        composable(route = "taxameter/{tourId}") {
            val tourId = it.arguments?.getString("tourId")?.toInt()
            Taxameter(navController, userViewModel, tourId!!)
        }
    }
}
