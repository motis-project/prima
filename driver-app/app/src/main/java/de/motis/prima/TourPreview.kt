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
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.navigation.NavController
import dagger.hilt.android.lifecycle.HiltViewModel
import de.motis.prima.data.DataRepository
import de.motis.prima.services.Event
import java.util.Date
import javax.inject.Inject

data class Location(
    val latitude: Double,
    val longitude: Double,
)

data class EventGroup(
    val id: String,
    val arrivalTime: Long,
    val location: Location,
    val address: String,
    val events: MutableList<Event>,
    var stopIndex: Int,
    var hasPickup: Boolean
)

@HiltViewModel
class TourViewModel @Inject constructor(
    val repository: DataRepository
) : ViewModel() {
    val eventGroups = repository.eventGroups
}

@Composable
fun TourPreview(
    navController: NavController,
    tourId: Int,
    viewModel: TourViewModel = hiltViewModel()
) {
    val eventGroups = viewModel.eventGroups.collectAsState().value

    Scaffold(
        topBar = {
            TopBar(
                "tours",
                stringResource(id = R.string.tour_preview_header),
                true,
                emptyList(),
                navController
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
                horizontalArrangement = Arrangement.Center
            ) {
                WayPointsView(eventGroups)
            }

            Spacer(modifier = Modifier.height(48.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.Center
            ) {
                Button(
                    modifier = Modifier.width(300.dp),
                    onClick = {
                        navController.navigate("leg/$tourId/0")
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
fun WayPointsView(eventGroups: List<EventGroup>) {
    Column {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.Center
        ) {
            LazyColumn {
                items(items = eventGroups, itemContent = { eventGroup ->
                    WayPointPreview(eventGroup)
                })
            }
        }
    }
}

@Composable
fun WayPointPreview(
    eventGroup: EventGroup
) {
    val scheduledTime: String
    var city = "GPS Navigation"
    val event = eventGroup.events[0]

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
        Column(modifier = Modifier.padding(10.dp)) {
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
