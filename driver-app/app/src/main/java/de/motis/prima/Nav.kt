package de.motis.prima

import android.util.Log
import androidx.compose.runtime.Composable
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import de.motis.prima.app.DriversApp
import de.motis.prima.services.CookieStore

@Composable
fun Nav() {

    val navController = rememberNavController()

    // Check before render of any component whether user is authenticated.
    val startDestination by remember {
        derivedStateOf {
            val cookieStore = CookieStore(DriversApp.instance)
            if (cookieStore.isEmpty()) {
                Log.d("Cookie", "No Cookie found. Navigating to Login.")
                "login"
            } else {
                Log.d("Cookie", "Cookie found. Navigating to Journeys.")
                "home"
            }
        }
    }

    NavHost(navController = navController, startDestination = startDestination) {

        composable(route = "login") {
            Login(navController)
        }

        composable(route = "home") {
            Home(navController)
        }

        composable(route = "vehicles") {
            Vehicles(navController)
        }

        composable(route = "tours") {
            Tours(navController)
        }
    }
}
