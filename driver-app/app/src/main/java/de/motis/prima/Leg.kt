package de.motis.prima

import android.util.Log
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Button
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.navigation.NavController
import dagger.hilt.android.lifecycle.HiltViewModel
import de.motis.prima.data.DataRepository
import javax.inject.Inject

@HiltViewModel
class LegViewModel @Inject constructor(
    repository: DataRepository
) : ViewModel() {
    val eventGroups = repository.eventGroups
}

@Composable
fun Leg(
    navController: NavController,
    tourId: Int,
    eventGroupIndex: Int,
    legViewModel: LegViewModel = hiltViewModel()
) {
    Log.d("debug", "eventGroupIndex: $eventGroupIndex")

    val eventGroups = legViewModel.eventGroups.collectAsState().value

    Scaffold(
        topBar = {
            TopBar(
                if (eventGroupIndex != 0) "leg/$tourId/${eventGroupIndex - 1}" else "preview/$tourId",
                "Fahrt",
                true,
                listOf(
                    NavItem(
                        text = stringResource(id = R.string.cancel_tour),
                        action = { navController.navigate("tours") }
                    )
                ),
                navController
            )
        }
    ) { contentPadding ->
        var isLastStop = false

        if (eventGroupIndex + 1 == eventGroups.size) {
            isLastStop = true
        }

        Column(Modifier.fillMaxHeight()) {
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
                if (eventGroups.isNotEmpty()) {
                    ShowEventGroup(
                        navController,
                        eventGroups[eventGroupIndex]
                    )
                }
            }

            Row(
                modifier = Modifier
                    .fillMaxSize(),
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.Bottom
            ) {
                Box(
                    modifier = Modifier
                        .padding(bottom = 56.dp)
                ) {
                    if (!isLastStop) {
                        Button(
                            modifier = Modifier.width(300.dp),
                            onClick = {
                                navController.navigate("leg/$tourId/${eventGroupIndex + 1}")
                            }
                        ) {
                            Text(
                                text = "Nächstes Ziel",
                                fontSize = 24.sp,
                                textAlign = TextAlign.Center
                            )
                        }
                    } else {
                        Button(
                            modifier = Modifier.width(300.dp),
                            onClick = {
                                navController.navigate("fare/$tourId") {}
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

@Composable
fun ShowEventGroup(
    navController: NavController,
    currentEventGroup: EventGroup
) {
    BoxWithConstraints {
        val screenWidth = maxWidth
        val screenHeight = maxHeight

        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            val height = screenHeight * 0.8f
            Box(
                modifier = Modifier
                    .height(height)
                    .width(screenWidth * 0.9f)
            ) {
                EventGroup(
                    navController,
                    currentEventGroup,
                    height
                )
            }
        }
    }
}
