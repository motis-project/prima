package de.motis.prima

import android.util.Log
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material3.Button
import androidx.compose.material3.CenterAlignedTopAppBar
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModel
import androidx.navigation.NavController
import de.motis.prima.app.DriversApp
import de.motis.prima.services.Event
import de.motis.prima.services.Tour
import kotlinx.coroutines.launch

data class Location(
    val latitude: Double,
    val longitude: Double,
)

class TourViewModel(tour: Tour) : ViewModel() {
    var id_: Int = tour.tour_id
    var tour_: Tour = tour
    var eventGroups: MutableMap<String, MutableList<Event>> = hashMapOf()

    private val locationUpdate = LocationUpdate.getInstance(DriversApp.instance)

    var currentLocation = Location(0.0, 0.0)

    private fun buildEventGroups(events: List<Event>) {
        val eventGroups = eventGroups
        for ((i, event) in events.withIndex()) {
            val groupId = i.toString() // event.groupId
            if (eventGroups[groupId] == null) {
                eventGroups[groupId] = mutableListOf(event)
            } else {
                eventGroups[groupId]?.add(event)
            }
        }
    }

    fun fetchLocation() {
        locationUpdate.getCurrentLocation { latitude, longitude ->
            if (latitude != null && longitude != null) {
                currentLocation = Location(latitude, longitude)
                Log.d("location", currentLocation.toString())
            } else {
                Log.d("location", "Unable to fetch location.")
            }
        }
    }

    init {
        buildEventGroups(tour.events)
        fetchLocation()
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TourView(
    navController: NavController,
    userViewModel: UserViewModel,
    tourViewModel: TourViewModel
) {
    LaunchedEffect(key1 = userViewModel) {
        launch {
            userViewModel.logoutEvent.collect {
                Log.d("Logout", "Logout event triggered.")
                navController.navigate("login") {
                    launchSingleTop = true
                }
            }
        }
    }

    var dropdownExpanded by remember {
        mutableStateOf(false)
    }

    Scaffold(
        topBar = {
            CenterAlignedTopAppBar(
                colors = TopAppBarDefaults.centerAlignedTopAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primaryContainer,
                    titleContentColor = MaterialTheme.colorScheme.primary,
                ),
                title = {
                    Text(
                        "Fahrt Übersicht",
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                },
                navigationIcon = {
                    IconButton(onClick = { navController.navigate("tours") }) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Localized description"
                        )
                    }
                },
                actions = {
                    IconButton(onClick = { dropdownExpanded = !dropdownExpanded }) {
                        Icon(Icons.Filled.MoreVert, contentDescription = "More Options")
                    }
                    DropdownMenu(
                        expanded = dropdownExpanded,
                        onDismissRequest = { dropdownExpanded = false }
                    ) {
                        DropdownMenuItem(
                            onClick = {
                                dropdownExpanded = false
                                navController.navigate("vehicles")

                            },
                            text = {Text("Fahrzeug wechseln")}
                        )
                        DropdownMenuItem(
                            onClick = {
                                userViewModel.logout()
                                dropdownExpanded = false

                            },
                            text = { Text("Logout") }
                        )
                    }
                }
            )

        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            Spacer(modifier = Modifier.height(42.dp))
            Row(
                modifier = Modifier.fillMaxWidth().height(650.dp),
                horizontalArrangement = Arrangement.Center
            ) {
                WayPointsView(tourViewModel, navController)
            }

            Spacer(modifier = Modifier.height(48.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.Center
            ) {
                Button(
                    modifier = Modifier.width(300.dp),
                    onClick = {
                        // LegView
                        navController.navigate("legs/${tourViewModel.id_}/0")
                    }
                ) {
                    Text(
                        text = "Fahrt starten",
                        fontSize = 24.sp,
                        textAlign = TextAlign.Center
                    )
                }
            }
        }
    }
}

@Composable
fun WayPointsView(
    tourViewModel: TourViewModel,
    navController: NavController) {

    val events = tourViewModel.tour_.events
    var lastEvent = events[0]
    var timeBegin = "-"
    var timeEnd = "-"

    try {
        timeBegin = events[0].scheduled_time
            .replace("T", " ")
            .toDate()
            .formatTo("HH:mm")
        lastEvent = events[events.size - 1]
        timeEnd = lastEvent.scheduled_time
            .replace("T", " ")
            .toDate()
            .formatTo("HH:mm")
    } catch (e: Exception) {
        Log.d("error", "Failed to get tour details")
        return
    }

    Column {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.Center
        ) {
            Text(
                text = "Beginn: $timeBegin",
                fontSize = 24.sp,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center
            )
        }
        Row(
            modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp),
            horizontalArrangement = Arrangement.Center
        ) {
            Text(
                text = "Ende: $timeEnd",
                fontSize = 24.sp,
                textAlign = TextAlign.Center
            )
        }
        Spacer(modifier = Modifier.height(24.dp))
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.Center
        ) {
            LazyColumn(
            ) {
                items(items = events, itemContent = { event ->
                    EventDetail(0,0, event, false, tourViewModel.currentLocation, "", navController)
                })
            }
        }
    }
}
