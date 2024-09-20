package com.example.opnvtaxi

import android.util.Log
import androidx.compose.runtime.Composable
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.example.opnvtaxi.app.TaxidriverApp
import com.example.opnvtaxi.services.CookieStore

@Composable
fun Nav() {

    val navController = rememberNavController()

    // Check before render of any component whether user is authenticated.
    val startDestination by remember {
        derivedStateOf {
            val cookieStore = CookieStore(TaxidriverApp.instance)
            if (cookieStore.isEmpty()) {
                Log.d("Cookie", "No Cookie found. Navigating to Login.")
                "login"
            } else {
                Log.d("Cookie", "Cookie found. Navigating to Journeys.")
                "journeys"
            }
        }
    }

    NavHost(navController = navController, startDestination = startDestination) {

        composable(route = "login") {
            Login(navController)
        }

        composable(route = "journeys") {
            Journeys(navController)
            /*JourneysActivity(navController)*/
        }

        composable(route = "journey/{id}") {
            val journeys = getJourneys()
            val journeyId = it.arguments?.getString("id")
            val journey = journeys.findLast { j ->
                j.id == journeyId
            }
            JourneysListItem(navController, journey!!)
        }
    }
}