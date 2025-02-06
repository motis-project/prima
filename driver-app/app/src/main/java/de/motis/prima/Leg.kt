package de.motis.prima

import android.util.Log
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
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
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController


@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LegView(
    eventGroupIndex: Int,
    tourViewModel: TourViewModel,
    userViewModel: UserViewModel,
    scanViewModel: ScanViewModel,
    navController: NavController,
) {
    var isLastStop = false
    val tour = tourViewModel.tour_
    val eventGroups = tourViewModel.eventGroups

    if (eventGroupIndex + 1 == eventGroups.size) {
        isLastStop = true
    }

    /*if (eventGroupIndex == 0) {
        tourViewModel.fetchLocation()
        currentLocation = tourViewModel.currentLocation
    } else {
        val prevEvent = tour.events[eventGroupIndex - 1]
        currentLocation = Location(latitude = prevEvent.latitude, longitude = prevEvent.longitude)
    }*/

    val validTickets by scanViewModel.validTickets.collectAsState()

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
                    val destination =
                        if (eventGroupIndex - 1 >= 0) "legs/${tourViewModel.id_}/${eventGroupIndex - 1}"
                        else "tour/${tourViewModel.id_}"
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
                                userViewModel.logout()
                                dropdownExpanded = false

                            },
                            text = { Text("Logout") }
                        )
                    }
                }
            )

        }
    ) { contentPadding ->
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
                        text = "${eventGroupIndex + 1} / ${eventGroups.size}",
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
                    EventGroup(
                        EventGroupViewModel(
                            eventGroupIndex,
                            "", // TODO: group ID
                            tourViewModel
                            ),
                        navController,
                        scanViewModel)
                }
            }
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.Center
            ) {
                if (!isLastStop) {
                    Box {
                        Button(
                            modifier = Modifier.width(250.dp),
                            onClick = {
                                navController.navigate("legs/${tour.tour_id}/${eventGroupIndex + 1}")
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
                                Log.d("test", validTickets.toString())
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
}