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
import androidx.compose.foundation.layout.wrapContentSize
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material3.Button
import androidx.compose.material3.Card
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
import de.motis.prima.services.Event
import de.motis.prima.services.Tour
import kotlinx.coroutines.launch
import java.util.Date

data class Location(
    val latitude: Double,
    val longitude: Double,
)

data class EventGroup(
    val id: String,
    val arrivalTime: String,
    val location: Location,
    val events: MutableList<Event>,
    val tickets: List<Ticket>
)

class TourViewModel(tour: Tour) : ViewModel() {
    var id_: Int = tour.tourId
    var tour_: Tour = tour
    var eventGroups: MutableList<EventGroup> = mutableListOf()

    private fun buildEventGroups(events: List<Event>) {
        for (event in events) {
            val matchingGroups = eventGroups.filter { group -> group.id == event.eventGroup }
            // size of matchingGroups should be 0 or 1
            if (matchingGroups.isEmpty()) {
                eventGroups.add(
                    EventGroup(
                        event.eventGroup,
                        event.scheduledTimeStart.toString(),
                        Location(event.lat, event.lng),
                        mutableListOf(event),
                        emptyList()
                    )
                )
            } else if (matchingGroups.size == 1) {
                matchingGroups[0].events.add(event)
            } else {
                Log.d("error", "buildEventGroups: groupId not unique")
            }
        }
        Log.d("groups", eventGroups.toString())
    }

    init {
        buildEventGroups(tour.events)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TourPreview(
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
                //modifier = Modifier.fillMaxWidth().height(650.dp),
                horizontalArrangement = Arrangement.Center
            ) {
                WayPointsView(tourViewModel)
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
fun WayPointsView(tourViewModel: TourViewModel) {
    Column {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.Center
        ) {
            LazyColumn(
            ) {
                items(items = tourViewModel.tour_.events, itemContent = { event -> // TODO: change to event groups
                    WayPointPreview(event)
                })
            }
        }
    }
}

@Composable
fun WayPointPreview(
    event: Event
) {
    val scheduledTime: String
    var city = "GPS Navigation"

    try {
        scheduledTime = Date(event.scheduledTimeStart).formatTo("HH:mm")
        if (event.address != "") {
            val parts = event.address.split(',')
            if (parts.size == 2) {
                city = parts[1]
            }
        }
    } catch (e: Exception) {
        Log.d("error", "Failed to read event details")
        return
    }

    Card(
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier
            .fillMaxWidth()
            .padding(start = 24.dp, end = 24.dp, bottom = 24.dp)
            .wrapContentSize()
    ) {
        Column (modifier = Modifier.padding(10.dp) ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.Center
            ) {
                Text(
                    text = scheduledTime,
                    fontWeight = FontWeight.Bold,
                    fontSize = 24.sp,
                    textAlign = TextAlign.Center
                )
            }
            Spacer(modifier = Modifier.height(10.dp))
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 12.dp),
                horizontalArrangement = Arrangement.Center
            ) {
                Text(
                    text = city,
                    fontSize = 24.sp,
                    textAlign = TextAlign.Center
                )
            }
        }
    }
}
