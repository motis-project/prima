package de.motis.prima.ui

import android.graphics.drawable.Icon
import android.util.Log
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Face
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.unit.dp
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.focusModifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.motionEventSpy
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.navigation.NavController
import dagger.hilt.android.lifecycle.HiltViewModel
import de.motis.prima.R
import de.motis.prima.data.DataRepository
import de.motis.prima.ui.theme.LocalExtendedColors
import javax.inject.Inject

enum class TransportType {
    TAXI, TRAIN, WALK
}

data class ItineraryItem(
    val arrivalTime: String,
    val departureTime: String,
    val from: String,
    val to: String,
    val subtitle: String? = null,
    val transportType: TransportType,
    val isLast: Boolean = false
)

@HiltViewModel
class ItineraryViewModel @Inject constructor(
    private val repository: DataRepository
) : ViewModel() {
    val ptLegs = repository.ptLegs
}

@Composable
fun ItineraryScreen(
    navController: NavController,
    requestId: Int,
    viewModel: EventGroupViewModel = hiltViewModel(),
) {
    val ptLegs by viewModel.ptLegs.collectAsState()

    Log.d("test", "startTime: ${ptLegs[requestId]?.scheduledStartTime}")

    val itinerary = listOf(
        ItineraryItem(
            departureTime = "20:35",
            arrivalTime = "21:15",
            from = "Klein Priebus, Krauschwitz – Krušwica",
            to = "Weißwasser Bahnhof",
            subtitle = "40 min Public Transport Taxi · 27 km · Booking required",
            transportType = TransportType.TAXI
        ),
        ItineraryItem(
            departureTime = "21:20",
            arrivalTime = "21:26",
            from = "Weißwasser Bahnhof",
            to = "Schleife Bahnhof",
            subtitle = "5 min transfer",
            transportType = TransportType.TRAIN
        ),
        ItineraryItem(
            departureTime = "21:26",
            arrivalTime = "21:27",
            from = "Schleife Bahnhof",
            to = "Schleife, Slepo",
            subtitle = "1 min walk",
            transportType = TransportType.WALK,
            isLast = true
        )
    )

    Scaffold(
        topBar = {
            TopBar(
                "Itinerary",
                false,
                emptyList(),
                navController
            )
        }
    ) { contentPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(contentPadding)
        ) {
            LazyColumn(
                modifier = Modifier
                    .padding(20.dp)
                    .background(Color.White)
            ) {
                items(itinerary) { item ->
                    ItineraryRow(item = item)
                }
            }
        }
    }
}

@Composable
fun ItineraryRow(
    item: ItineraryItem
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
    ) {

        // ───── Timeline column (icon + line) ─────
        val height = 130.dp
        Column(
            modifier = Modifier.fillMaxWidth()
        ) {

            TransportIcon(item.transportType)

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Spacer(Modifier.width(10.dp))
                Box(
                    modifier = Modifier
                        .width(2.dp)
                        .height(height)
                        .background(transportColor(item.transportType))
                )
                Box(
                    modifier = Modifier
                        .width(100.dp)
                        .height(height)
                        .background(Color.White)
                ) {
                    Column(
                        modifier = Modifier
                            .padding(top = 10.dp, bottom = 10.dp, start = 30.dp)
                            .fillMaxHeight(),
                        verticalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            text = item.departureTime,
                            style = MaterialTheme.typography.labelMedium,
                            color = Color.Black
                        )
                        Text(
                            text = item.arrivalTime,
                            style = MaterialTheme.typography.labelMedium,
                            color = Color.Black
                        )
                    }
                }
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(height)
                        .background(Color.White)
                ) {
                    // ───── Text content ─────
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(top = 10.dp, bottom = 10.dp),
                        verticalArrangement = Arrangement.SpaceBetween
                    ) {
                        Box {
                            Text(
                                text = item.from,
                                style = MaterialTheme.typography.titleMedium,
                                color = Color.Black
                            )
                        }
                        Box(
                            modifier = Modifier.padding(20.dp)
                        ) {
                            item.subtitle?.let {
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(
                                    text = it,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = Color.Black
                                )
                            }
                        }
                        Box {
                            Text(
                                text = item.to,
                                style = MaterialTheme.typography.titleMedium,
                                color = Color.Black
                            )
                        }
                    }
                }
            }

            if (item.isLast) {
                Row(
                    modifier = Modifier.padding(start = 5.dp)
                ) {
                    TransportIcon(item.transportType, true)
                }
            }
        }
    }
}

@Composable
fun TransportIcon(type: TransportType, terminal: Boolean = false) {
    val (icon, bgColor) = when (type) {
        TransportType.TAXI ->
            Icons.Default.Face to Color(0xFFFFC107)
        TransportType.TRAIN ->
            Icons.Default.Face to Color(0xFFD32F2F)
        TransportType.WALK ->
            Icons.Default.Face to Color(0xFFBDBDBD)
    }

    if (terminal.not()) {
        Box(
            modifier = Modifier
                .clip(RoundedCornerShape(8.dp))
                .background(bgColor),
            contentAlignment = Alignment.Center
        ) {
            Row(
                modifier = Modifier
                    .width(80.dp), // TODO: content width
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center
            ){
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = Color.White,
                    modifier = Modifier.size(16.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text("Taxi")
            }
        }
    } else {
        Box(
            modifier = Modifier
                .clip(CircleShape)
                .size(12.dp)
                .background(bgColor),
            contentAlignment = Alignment.Center
        ) {}
    }
}

fun transportColor(type: TransportType): Color =
    when (type) {
        TransportType.TAXI -> Color(0xFFFFC107)
        TransportType.TRAIN -> Color(0xFFD32F2F)
        TransportType.WALK -> Color(0xFFBDBDBD)
    }
