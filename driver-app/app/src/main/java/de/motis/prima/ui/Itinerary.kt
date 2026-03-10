package de.motis.prima.ui

import android.util.Log
import android.widget.Space
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonColors
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalDrawerSheet
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.navigation.NavController
import dagger.hilt.android.lifecycle.HiltViewModel
import de.motis.prima.R
import de.motis.prima.data.DataRepository
import de.motis.prima.services.Place
import de.motis.prima.ui.theme.LocalExtendedColors
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import javax.inject.Inject

enum class TransportType {
    TAXI, TRAIN, WALK
}

data class ItineraryItem(
    val arrivalTime: String,
    val departureTime: String,
    val from: String,
    val to: String,
    val intermediateStops: List<Place> = emptyList(),
    val transportType: TransportType,
    var isLast: Boolean = false,
    val name: String
)

@HiltViewModel
class ItineraryViewModel @Inject constructor(
    private val repository: DataRepository
) : ViewModel() {
    val ptLegs = repository.ptLegs
}

fun isoToLocalTime(isoString: String): String {
    val instant = Instant.parse(isoString)
    val localDateTime = instant.atZone(ZoneId.systemDefault())
    val formatter = DateTimeFormatter
        .ofPattern("HH:mm", Locale.getDefault())
    val formatted = localDateTime.format(formatter)

    return formatted
}

fun epochToLocalTime(epochMillis: Long): String {
    val zoneId = ZoneId.systemDefault()
    val time = Instant.ofEpochMilli(epochMillis).atZone(zoneId)
    val formatter = DateTimeFormatter
        .ofPattern("HH:mm", Locale.getDefault())
    val formatted = time.format(formatter)

    return formatted
}

@Composable
fun ItineraryScreen(
    navController: NavController,
    requestId: Int,
    eventId: Int,
    viewModel: EventGroupViewModel = hiltViewModel(),
) {
    val ptLegs by viewModel.ptLegs.collectAsState()
    val itinerary = mutableListOf<ItineraryItem>()

    val leg = ptLegs[requestId]
    if (leg != null) {
        itinerary.add(
            ItineraryItem(
                departureTime = isoToLocalTime(leg.from.scheduledDeparture ?: "-:-"),
                arrivalTime = isoToLocalTime(leg.to.scheduledArrival ?: "-:-"),
                from = leg.from.name.toString(),
                to = leg.to.name.toString(),
                intermediateStops = leg.intermediateStops,
                transportType = TransportType.TRAIN,
                name = leg.displayName.toString()
            )
        )
    }

    var taxiFrom = ""
    var taxiTo = ""
    var taxiDeparture = ""
    var taxiArrival = ""
    var isPickup = true

    val event = viewModel.getEvent(eventId)
    if (event != null) {
        isPickup = event.isPickup
        val time = epochToLocalTime(event.scheduledTime)
        if (event.isPickup) {
            taxiFrom = event.address
            taxiDeparture = time
        } else {
            taxiTo = event.address
            taxiArrival = time
        }

        itinerary.add(
            ItineraryItem(
                departureTime = taxiDeparture,
                arrivalTime = taxiArrival,
                from = taxiFrom,
                to = taxiTo,
                transportType = TransportType.TAXI,
                name = "Taxi"
            )
        )
    }

    itinerary.sortBy { e -> e.departureTime }
    itinerary.last().isLast = true

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
                    ItineraryRow(item = item, isPickup)
                }
            }
        }
    }
}

@Composable
fun ItineraryRow(
    item: ItineraryItem,
    isPickup: Boolean
) {
    val isTaxi = item.transportType == TransportType.TAXI
    val baseHeight = if (isTaxi) 80.dp else 160.dp
    var height by remember { mutableStateOf(baseHeight) }
    val interStopHeight = 30.dp

    var intermediateStops = item.intermediateStops

    intermediateStops = if (isPickup) {
        intermediateStops.takeLast(3)
    } else {
        intermediateStops.take(3)
    }

    val nInterStops = intermediateStops.size

    var extended by remember { mutableStateOf(false) }

    val distTimeName = 48.dp

    Column(
        modifier = Modifier
            .fillMaxWidth()
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
        ) {
            TransportIcon(item.transportType, false, item.name)
        }

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(height)
        ) {
            Column(
                modifier = Modifier
                    .width(18.dp)
            ) {
                if (item.isLast.not()) {
                    Row {
                        Spacer(modifier = Modifier.width(14.dp))
                        Box(
                            modifier = Modifier
                                .width(2.dp)
                                .height(height)
                                .background(transportColor(item.transportType))
                        )
                    }
                } else {
                    Row {
                        Spacer(modifier = Modifier.width(14.dp))
                        Box(
                            modifier = Modifier
                                .width(2.dp)
                                .height(height - 30.dp)
                                .background(transportColor(item.transportType))
                        )
                    }
                    Row {
                        Spacer(modifier = Modifier.width(9.dp))
                        Box {
                            TransportIcon(item.transportType, true, "")
                        }
                    }
                }
            }
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(16.dp),
                verticalArrangement = Arrangement.SpaceBetween
            ) {
                if (isTaxi || isPickup.not()) {
                    Row {
                        Text(
                            text = item.departureTime,
                            style = MaterialTheme.typography.labelMedium,
                            color = Color.Black,
                            fontSize = 20.sp
                        )
                        Spacer(modifier = Modifier.width(distTimeName))
                        Text(
                            text = item.from,
                            style = MaterialTheme.typography.titleMedium,
                            color = Color.Black,
                            fontSize = 20.sp
                        )
                    }
                }
                Row {
                    Column {
                        Box {
                            if (item.intermediateStops.isEmpty().not()) {
                                Spacer(modifier = Modifier.height(4.dp))
                                Button(
                                    colors = ButtonColors(
                                        Color.White,
                                        Color.White,
                                        Color.White,
                                        Color.White
                                    ),
                                    onClick = {
                                        extended = extended.not()
                                        height = if (extended) {
                                            baseHeight + interStopHeight * nInterStops
                                        } else {
                                            baseHeight
                                        }
                                    }) {
                                    Row {
                                        Icon(
                                            imageVector = if (extended) Icons.Default.KeyboardArrowUp else Icons.Default.KeyboardArrowDown,
                                            contentDescription = "Localized description",
                                            modifier = Modifier
                                                .size(width = 20.dp, height = 20.dp)
                                                .background(Color.White),
                                            tint = LocalExtendedColors.current.textColor
                                        )
                                        Spacer(modifier = Modifier.width(10.dp))
                                        Text(
                                            text = "Zwischenhalte",
                                            style = MaterialTheme.typography.bodySmall,
                                            color = Color.Black,
                                            fontSize = 20.sp
                                        )
                                    }
                                }
                            }
                        }
                        if (extended) {
                            LazyColumn {
                                items(intermediateStops) { stop ->
                                    val scheduledDeparture = isoToLocalTime(stop.scheduledDeparture ?: "-:-")
                                    val name = stop.name ?: "-"
                                    Spacer(modifier = Modifier.height(12.dp))
                                    Row {
                                        Text(
                                            text = scheduledDeparture,
                                            style = MaterialTheme.typography.labelMedium,
                                            color = Color.Black,
                                            fontSize = 20.sp
                                        )
                                        Spacer(modifier = Modifier.width(distTimeName))
                                        Text(
                                            text = name,
                                            style = MaterialTheme.typography.titleMedium,
                                            color = Color.Black,
                                            fontSize = 20.sp
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
                if (isTaxi || isPickup) {
                    Row {
                        Text(
                            text = item.arrivalTime,
                            style = MaterialTheme.typography.labelMedium,
                            color = Color.Black,
                            fontSize = 20.sp
                        )
                        Spacer(modifier = Modifier.width(distTimeName))
                        Text(
                            text = item.to,
                            style = MaterialTheme.typography.titleMedium,
                            color = Color.Black,
                            fontSize = 20.sp
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun TransportIcon(mode: TransportType, terminal: Boolean = false, name: String) {
    val (icon, bgColor) = when (mode) {
        TransportType.TAXI ->
            R.drawable.ic_taxi to transportColor(TransportType.TAXI)
        TransportType.TRAIN ->
            R.drawable.ic_train to transportColor(TransportType.TRAIN)
        TransportType.WALK ->
            R.drawable.ic_walk to transportColor(TransportType.WALK)
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
                    painter = painterResource(id = icon),
                    contentDescription = null,
                    tint = Color.White,
                    modifier = Modifier.size(16.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text= name,
                    color = Color.White
                )
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
