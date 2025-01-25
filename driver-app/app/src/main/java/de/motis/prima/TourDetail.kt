package de.motis.prima

import android.content.res.Configuration
import android.util.Log
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import kotlinx.coroutines.launch

data class Location(
    val latitude: Double,
    val longitude: Double,
)

@Composable
fun PortraitLayout(
    navController: NavController,
    tourId: Int,
    eventIndex: Int,
    toursViewModel: ToursViewModel,
    scanViewModel: ScanViewModel,
    contentPadding: PaddingValues
) {
    var isLastEvent = false
    val tour = toursViewModel.tours.value.filter { t -> t.tour_id == tourId }[0]
    val event = tour.events[eventIndex]

    var currentLocation: Location

    if (eventIndex + 1 == tour.events.size) {
        isLastEvent = true
    }

    if (eventIndex == 0) {
        // Test: Taxi company home in Weisswasser
        // currentLocation = Location(latitude = 51.493713, longitude = 14.625855)
        toursViewModel.fetchLocation()
        currentLocation = toursViewModel.currentLocation
    } else {
        val prevEvent = tour.events[eventIndex - 1]
        currentLocation = Location(latitude = prevEvent.latitude, longitude = prevEvent.longitude)
    }

    // test
    Log.d("test", "In TourDetail: ${scanViewModel.ticket.value}")

    Column(
        modifier = Modifier
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.Center
        ) {
            Box(
                modifier = Modifier
                .padding(contentPadding)
            ) {
                Text(
                    text = "${eventIndex + 1} / ${tour.events.size}",
                    fontSize = 24.sp,
                    textAlign = TextAlign.Center
                )
            }
        }
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.Center
        ) {
            Box {
                EventDetail(tourId, eventIndex, event, true, currentLocation, navController)
            }
        }
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.Center
        ) {
            if (!isLastEvent) {
                Box {
                    Button(
                        modifier = Modifier.width(250.dp),
                        onClick = {
                            navController.navigate("legs/${tour.tour_id}/${eventIndex + 1}")
                        }
                    ) {
                        Text(
                            text = "Nächstes Ziel",
                            fontSize = 24.sp,
                            textAlign = TextAlign.Center
                        )
                    }
                }
            } else {
                Box(
                    modifier = Modifier
                        .padding(contentPadding)
                ) {
                    Button(
                        modifier = Modifier.width(300.dp),
                        onClick = {
                            navController.navigate("taxameter") {}
                        }
                    ) {
                        Text(
                            text = "Fahrt abgeschlossen",
                            fontSize = 24.sp,
                            textAlign = TextAlign.Center
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun LandscapeLayout(
    navController: NavController,
    tourId: Int,
    eventIndex: Int,
    toursViewModel: ToursViewModel
) {
    Row(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
    ) {
        Column(
            modifier = Modifier
                .weight(1f)
                .fillMaxHeight()
                .background(Color.LightGray),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text("Row 1", fontSize = 20.sp, modifier = Modifier.padding(16.dp))
        }

        Column(
            modifier = Modifier
                .weight(1f)
                .fillMaxHeight()
                .background(Color.Gray),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text("Row 2", fontSize = 20.sp, modifier = Modifier.padding(16.dp))
        }

        Column(
            modifier = Modifier
                .weight(1f)
                .fillMaxHeight()
                .background(Color.DarkGray),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text("Row 3", fontSize = 20.sp, modifier = Modifier.padding(16.dp))
        }
    }
}

@Composable
fun HandleOrientationChanges(
    navController: NavController,
    tourId: Int,
    eventIndex: Int,
    toursViewModel: ToursViewModel,
    scanViewModel: ScanViewModel,
    contentPadding: PaddingValues
) {
    val configuration = LocalConfiguration.current
    val isLandscape = configuration.orientation == Configuration.ORIENTATION_LANDSCAPE
    if (isLandscape) {
        LandscapeLayout(
            navController,
            tourId,
            eventIndex,
            toursViewModel
        )
    } else {
        PortraitLayout(
            navController,
            tourId,
            eventIndex,
            toursViewModel,
            scanViewModel,
            contentPadding
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TourDetail(
    navController: NavController,
    tourId: Int,
    eventIndex: Int,
    toursViewModel: ToursViewModel,
    scanViewModel: ScanViewModel
) {
    LaunchedEffect(key1 = toursViewModel) {
        launch {
            toursViewModel.logoutEvent.collect {
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
                        "Fahrt",
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                },
                navigationIcon = {
                    val destination = if(eventIndex - 1 >= 0) "legs/${tourId}/${eventIndex - 1}"
                    else "overview/${tourId}"
                    IconButton(onClick = { navController.navigate(destination) }) {
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
                                navController.navigate("tours")
                                dropdownExpanded = false

                            },
                            text = { Text("Fahrt abbrechen") }
                        )
                        DropdownMenuItem(
                            onClick = {
                                toursViewModel.logout()
                                dropdownExpanded = false

                            },
                            text = { Text("Logout") }
                        )
                    }
                }
            )

        }
    ) { contentPadding ->
        HandleOrientationChanges(
            navController,
            tourId,
            eventIndex,
            toursViewModel,
            scanViewModel,
            contentPadding
        )
        Box(
            modifier = Modifier
            .padding(contentPadding)
        )
    }
}
