package de.motis.prima.ui

import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.util.Log
import androidx.annotation.ColorRes
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material.icons.filled.Done
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonColors
import androidx.compose.material3.Card
import androidx.compose.material3.CardColors
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.navigation.NavController
import androidx.navigation.NavOptions
import dagger.hilt.android.lifecycle.HiltViewModel
import de.motis.prima.R
import de.motis.prima.data.DataRepository
import de.motis.prima.data.EventObject
import de.motis.prima.data.EventObjectGroup
import de.motis.prima.data.Ticket
import de.motis.prima.data.ValidationStatus
import de.motis.prima.services.Itinerary
import de.motis.prima.ui.theme.LocalExtendedColors
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.util.Date
import javax.inject.Inject

@HiltViewModel
class EventGroupViewModel @Inject constructor(
    private val repository: DataRepository
) : ViewModel() {
    val storedTickets = repository.storedTickets

    private val _itinerary = MutableStateFlow<Itinerary?>(null)
    val itinerary: StateFlow<Itinerary?> = _itinerary.asStateFlow()

    fun onScreenExit() {
        repository.updateRequestIDs.clear()
    }

    private fun startUpdates() {
        viewModelScope.launch {
            repository
                .itineraryUpdates(intervalMs = 5_000)
                .collect { itinerary ->
                    _itinerary.value = itinerary
                }
        }
    }

    init {
        startUpdates()
    }

    fun getValidCount(eventGroupId: String): Int {
        var tickets = repository.getTicketsForEventGroup(eventGroupId)
        tickets = tickets.filter { t ->
            t.validationStatus == ValidationStatus.DONE.name ||
                    t.validationStatus == ValidationStatus.CHECKED_IN.name
        }
        return tickets.size
    }

    fun updateTicket(requestId: Int, ticketHash: String) {
        repository.updateTicketStore(Ticket(requestId, ticketHash, "", ValidationStatus.DONE))
    }

    fun setItinerary(requestId: Int) {
        repository.updateRequestIDs.add(requestId)
    }
}

data class Location(
    val lat: Double,
    val lng: Double,
)

fun openGoogleMapsNavigation(to: Location, context: Context) {
    val gmmIntentUri = Uri.parse("google.navigation:q=${to.lat},${to.lng}")
    val mapIntent = Intent(Intent.ACTION_VIEW, gmmIntentUri)
    mapIntent.setPackage("com.google.android.apps.maps")

    // Check if Google Maps App is installed
    if (mapIntent.resolveActivity(context.packageManager) != null) {
        context.startActivity(mapIntent)
    } else {
        // Fallback to browser
        val googleMapsUrl =
            "https://www.google.com/maps/dir/?api=1&destination=${to.lat},${to.lng}&travelmode=driving"

        val intent = Intent(Intent.ACTION_VIEW)
        intent.setData(Uri.parse(googleMapsUrl))
        intent.setPackage("com.android.chrome")

        // Check if Chrome is installed
        if (intent.resolveActivity(context.packageManager) != null) {
            context.startActivity(intent)
        } else {
            // Fallback to any browser
            intent.setPackage(null)
            context.startActivity(intent)
        }
    }
}

fun phoneCall(number: String?, context: Context) {
    val intent = Intent(Intent.ACTION_DIAL, Uri.fromParts("tel", number, null))
    context.startActivity(intent)
}

@Composable
fun EventGroup(
    navController: NavController,
    eventGroup: EventObjectGroup,
    nav: String,
    viewModel: EventGroupViewModel = hiltViewModel()
) {
    val validCount = viewModel.getValidCount(eventGroup.id)
    val nPickUp = eventGroup.events.filter { e -> e.isPickup && e.cancelled.not() }.size
    val hasUncheckedTicket = validCount < nPickUp

    DisposableEffect(Unit) {
        onDispose {
            viewModel.onScreenExit()
        }
    }


    val itinerary by viewModel.itinerary.collectAsState()

    itinerary?.let {
        Log.d("test", it.toString())
    }

    Column(
        modifier = Modifier
            .padding(10.dp),
        verticalArrangement = Arrangement.SpaceBetween
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .height(100.dp),
        ) {
            // time
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.Center
            ) {
                Text(
                    text = Date(eventGroup.arrivalTime).formatTo("HH:mm"),
                    fontWeight = FontWeight.Bold,
                    fontSize = 24.sp,
                    textAlign = TextAlign.Center
                )
            }

            // address
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.Center
            ) {
                if (eventGroup.address == "") {
                    if (eventGroup.location != Location(lat = 0.0, lng = 0.0)) {
                        Text(
                            text = "--",
                            fontSize = 24.sp,
                            textAlign = TextAlign.Center
                        )
                    } else {
                        Text(
                            text = "Fehler: Keine Navigation möglich",
                            fontSize = 24.sp,
                            textAlign = TextAlign.Center
                        )
                    }
                } else {
                    Text(
                        text = eventGroup.address,
                        fontSize = 24.sp,
                        textAlign = TextAlign.Center
                    )
                }
            }
        }

        Card(
            shape = RoundedCornerShape(12.dp),
            modifier = Modifier
                .weight(1f),
            colors = CardColors(LocalExtendedColors.current.containerColor, Color.White, Color.White, Color.White)
        ) {
            LazyColumn(
                modifier = Modifier
                    .weight(1f)
            ) {
                val validEvents = eventGroup.events
                    .filter { e -> e.cancelled.not() }
                    .sortedBy { it.scheduledTimeStart }
                items(items = validEvents, itemContent = { event ->
                    ShowCustomerDetails(event, viewModel, navController)
                })
            }
        }

        // buttons
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(80.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.Bottom
        ) {
            val context = LocalContext.current
            val buttonHeight = 48.dp

            Button(
                onClick = {
                    openGoogleMapsNavigation(eventGroup.location, context)
                },
                modifier = Modifier.height(buttonHeight)
            ) {
                Icon(
                    painter = painterResource(id = R.drawable.ic_map_marker),
                    contentDescription = "Localized description"
                )
            }

            if (hasUncheckedTicket) {
                val navOptions = NavOptions.Builder()
                    .setEnterAnim(0)
                    .setExitAnim(0)
                    .setPopEnterAnim(0)
                    .setPopExitAnim(0)
                    .build()
                val route = "scan/${eventGroup.id}"
                Button(
                    onClick = {
                        navController.navigate(
                            route,
                            navOptions
                        )
                    },
                    modifier = Modifier.height(buttonHeight)
                ) {
                    Icon(
                        painter = painterResource(id = R.drawable.ic_qr),
                        contentDescription = "Localized description"
                    )
                }
            }

            var showDialog by remember { mutableStateOf(false) }
            if (showDialog) {
                AlertDialog(
                    onDismissRequest = { showDialog = false },
                    title = { Text("Fehlende Tickets") },
                    text = { Text(stringResource(id = R.string.invalidated_tickets)) },
                    confirmButton = {
                        Button(onClick = {
                            showDialog = false
                            navController.navigate(nav)
                        }) {
                            Text("Ja, weiter")
                        }
                    },
                    dismissButton = {
                        Button(onClick = { showDialog = false }) {
                            Text("Nein")
                        }
                    }
                )
            }

            Button(
                onClick = {
                    if (hasUncheckedTicket) {
                        showDialog = true
                    } else {
                        navController.navigate(nav)
                    }
                },
                modifier = Modifier.height(buttonHeight)
            ) {
                Icon(
                    painter = painterResource(id = R.drawable.ic_arrow_right),
                    contentDescription = "Localized description"
                )
            }
        }
    }
}

@SuppressLint("DefaultLocale")
@Composable
fun ShowCustomerDetails(
    event: EventObject,
    viewModel: EventGroupViewModel,
    navController: NavController
) {
    val context = LocalContext.current
    val storedTickets = viewModel.storedTickets.collectAsState()
    val fareToPay: Double = (event.ticketPrice / 100).toDouble()

    val publicTransport = event.isPickup // TODO
    val ptScheduledTime = "20:35"
    val ptDelayed = false
    val ptStopCancelled = false
    val ptRideCancelled = false

    var ptColor = if (ptDelayed) Color.Red else Color(62, 130, 79)
    var ptRealTime = "20:35"

    if (ptStopCancelled) {
        ptRealTime = "Halt fällt aus"
        ptColor = Color.Red
    }
    if (ptRideCancelled) {
        ptRealTime = "Fahrt fällt aus"
        ptColor = Color.Red
    }

    Card(
        modifier = Modifier
            .padding(top = 10.dp)
            .padding(horizontal = 10.dp),
        colors = CardColors(LocalExtendedColors.current.cardColor, Color.Black, Color.White, Color.White)
    ) {
        Column(
            modifier = Modifier.padding(start = 8.dp, end = 8.dp)
        ) {
            // event time
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 8.dp, start = 8.dp),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                val displayTime = if (event.scheduledTime.toInt() != 0) {
                    Date(event.scheduledTime)
                        .formatTo("HH:mm")
                } else if (event.scheduledTimeStart.toInt() != 0) {
                    Date(event.scheduledTimeStart)
                        .formatTo("HH:mm")
                } else {
                    ""
                }

                Text(
                    text= displayTime,
                    fontWeight = FontWeight.Bold,
                    color = LocalExtendedColors.current.textColor
                )
            }
            // change info
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                if (publicTransport) {
                    viewModel.setItinerary(event.requestId)
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(8.dp)),
                        contentAlignment = Alignment.Center
                    ) {
                        Button(
                            onClick = {
                                // open PT detail view
                                //viewModel.(event.requestId)
                                navController.navigate("itinerary")
                            },
                            colors = ButtonColors(LocalExtendedColors.current.secondaryButton, LocalExtendedColors.current.textColor, Color.White, Color.White),
                        ) {
                            Icon(
                                painter = painterResource(id = R.drawable.ic_public_transport),
                                contentDescription = "Localized description",
                                Modifier.size(21.dp),
                                tint = if (ptStopCancelled || ptRideCancelled) Color.Red else LocalExtendedColors.current.textColor
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(if (event.isPickup) Color(62, 130, 79) else Color(94, 154, 191)),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    imageVector = if (event.isPickup) Icons.AutoMirrored.Filled.ArrowForward else Icons.AutoMirrored.Filled.ArrowBack,
                                    contentDescription = "Localized description",
                                    tint = LocalExtendedColors.current.cardColor
                                )
                            }
                        }
                    }
                    // PT scheduled time
                    Spacer(modifier = Modifier.width(12.dp))
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(8.dp)),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = ptScheduledTime,
                            fontSize = 16.sp,
                            textAlign = TextAlign.Center,
                            color = LocalExtendedColors.current.textColor
                        )
                    }
                    // PT real time
                    Spacer(modifier = Modifier.width(12.dp))
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(8.dp)),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = ptRealTime,
                            fontSize = 16.sp,
                            textAlign = TextAlign.Center,
                            color = ptColor
                        )
                    }
                } else {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.padding(start = 6.dp, end = 12.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(8.dp))
                                .background(if (event.isPickup) Color(62, 130, 79) else Color(94, 154, 191)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = if (event.isPickup) Icons.AutoMirrored.Filled.ArrowForward else Icons.AutoMirrored.Filled.ArrowBack,
                                contentDescription = "Localized description",
                                tint = LocalExtendedColors.current.cardColor
                            )
                        }
                    }
                }
            }
            val hasSpecialInfo = event.wheelchairs > 0 || event.kidsZeroToTwo > 0 || event.luggage > 0 || event.bikes > 0

            if (hasSpecialInfo) {
                Spacer(modifier = Modifier.height(4.dp))
                // special info
                Row(
                    modifier = Modifier
                        .clip(RoundedCornerShape(10.dp))
                        .background(Color.White)
                        .padding(4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    if (event.wheelchairs > 0) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.padding(start = 8.dp, end = 12.dp)
                        ) {
                            Icon(
                                painter = painterResource(id = R.drawable.ic_wheelchair),
                                contentDescription = "Localized description",
                                tint = LocalExtendedColors.current.textColor
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(
                                text = "${event.wheelchairs}",
                                fontSize = 22.sp,
                                textAlign = TextAlign.Center,
                                color = LocalExtendedColors.current.textColor
                            )
                        }
                    }
                    if (event.kidsZeroToTwo > 0) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.padding(start = 12.dp, end = 12.dp)
                        ) {
                            Icon(
                                painter = painterResource(id = R.drawable.ic_baby_stroller),
                                contentDescription = "Localized description",
                                tint = LocalExtendedColors.current.textColor,
                                modifier = Modifier.size(21.dp),
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(
                                text = "${event.kidsZeroToTwo}",
                                fontSize = 22.sp,
                                textAlign = TextAlign.Center,
                                color = LocalExtendedColors.current.textColor
                            )
                        }
                    }
                    if (event.luggage > 0) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.padding(end = 12.dp)
                        ) {
                            Icon(
                                painter = painterResource(id = R.drawable.ic_luggage),
                                contentDescription = "Localized description",
                                tint = LocalExtendedColors.current.textColor
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(
                                text = "${event.luggage}",
                                fontSize = 22.sp,
                                textAlign = TextAlign.Center,
                                color = LocalExtendedColors.current.textColor
                            )
                        }
                    }
                    if (event.bikes > 0) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.padding(start = 12.dp, end = 12.dp)
                        ) {
                            Icon(
                                painter = painterResource(id = R.drawable.ic_bike),
                                contentDescription = "Localized description",
                                tint = LocalExtendedColors.current.textColor
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(
                                text = "${event.bikes}",
                                fontSize = 22.sp,
                                textAlign = TextAlign.Center,
                                color = LocalExtendedColors.current.textColor
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(20.dp))
            Row(
                modifier = Modifier
                    .fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = event.customerName,
                    fontSize = 22.sp,
                    textAlign = TextAlign.Center,
                    color = LocalExtendedColors.current.textColor
                )
            }
            Spacer(modifier = Modifier.height(8.dp))
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 8.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                if (event.isPickup) {
                    if (event.customerPhone != null && event.customerPhone != "") {
                        Button(
                            onClick = {
                                phoneCall(event.customerPhone, context)
                            },
                            colors = ButtonColors(LocalExtendedColors.current.secondaryButton, LocalExtendedColors.current.textColor, Color.White, Color.White)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Call,
                                contentDescription = "Localized description"
                            )
                        }
                    } else {
                        Icon(
                            painter = painterResource(id = R.drawable.ic_no_phone),
                            contentDescription = "Localized description",
                            modifier = Modifier
                                .size(width = 24.dp, height = 24.dp)
                        )
                    }
                } else {
                    Box { /* place holder */ }
                }

                var ticketStatus: ValidationStatus = ValidationStatus.OPEN

                val ticketObject = storedTickets.value
                    .find { t -> t.ticketHash == event.ticketHash }

                ticketObject?.let { ticket ->
                    ticketStatus = ValidationStatus.valueOf(ticket.validationStatus)
                }

                if(event.ticketChecked) {
                    ticketStatus = ValidationStatus.DONE
                    viewModel.updateTicket(event.requestId, event.ticketHash)
                }


                Row(
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(
                        modifier = Modifier
                            .clip(RoundedCornerShape(8.dp))
                            .background(Color.White)
                            .height(height = 40.dp)
                            .padding(start = 6.dp, end = 6.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icon(
                            imageVector = Icons.Default.Person,
                            contentDescription = "Localized description",
                            tint = LocalExtendedColors.current.textColor
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = "${event.passengers}",
                            fontSize = 22.sp,
                            textAlign = TextAlign.Center,
                            color = LocalExtendedColors.current.textColor
                        )
                    }
                    Spacer(modifier = Modifier.width(width = 12.dp))
                    Text(
                        text = "${String.format("%.2f", fareToPay)} €",
                        fontSize = 22.sp,
                        textAlign = TextAlign.Center,
                        color = LocalExtendedColors.current.textColor
                    )
                    Spacer(modifier = Modifier.width(width = 12.dp))
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(10.dp))
                            .background(LocalExtendedColors.current.containerColor)
                            .size(height = 40.dp, width = 70.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.background(LocalExtendedColors.current.containerColor)
                        ) {
                            Icon(
                                painter = painterResource(id = R.drawable.ic_qr),
                                contentDescription = "Localized description",
                                modifier = Modifier
                                    .size(width = 30.dp, height = 30.dp),
                                tint = LocalExtendedColors.current.textColor
                            )

                            if (ticketStatus == ValidationStatus.OPEN) {
                                Icon(
                                    imageVector = Icons.Default.Clear,
                                    contentDescription = "Localized description",
                                    tint = Color.Gray,
                                    modifier = Modifier
                                        .size(width = 30.dp, height = 30.dp)
                                )
                            } else if (ticketStatus == ValidationStatus.DONE) {
                                Icon(
                                    imageVector = Icons.Default.Done,
                                    contentDescription = "Localized description",
                                    tint = Color.Green,
                                    modifier = Modifier
                                        .size(width = 32.dp, height = 32.dp)
                                )
                            } else if (ticketStatus == ValidationStatus.CHECKED_IN) {
                                Icon(
                                    imageVector = Icons.Default.Done,
                                    contentDescription = "Localized description",
                                    tint = Color.Gray,
                                    modifier = Modifier
                                        .size(width = 30.dp, height = 30.dp)
                                )
                            } else if (ticketStatus == ValidationStatus.REJECTED) {
                                Icon(
                                    imageVector = Icons.Default.Clear,
                                    contentDescription = "Localized description",
                                    tint = Color.Red,
                                    modifier = Modifier
                                        .size(width = 30.dp, height = 30.dp)
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}