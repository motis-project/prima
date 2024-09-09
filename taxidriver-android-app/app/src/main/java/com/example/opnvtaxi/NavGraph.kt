package com.example.opnvtaxi

import androidx.compose.runtime.Composable
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController

@Composable
fun Nav() {

    val navController = rememberNavController()
    NavHost(navController = navController, startDestination = "login") {

        composable(route = "login") {
            Login(navController)
        }

        composable(route = "journeys") {
            Journeys(navController)
            /*JourneysActivity(navController)*/
        }

        composable(route = "journey/{id}") { it ->
            val journeys = getJourneys()
            val journeyId = it.arguments?.getString("id")
            val journey = journeys.findLast { j ->
                j.id == journeyId
            }
            JourneysListItem(navController, journey!!)
        }
    }
}