package de.motis.prima.ui

import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.util.Log
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
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonColors
import androidx.compose.material3.Card
import androidx.compose.material3.CardColors
import androidx.compose.material3.Icon
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.navigation.NavController
import androidx.navigation.NavOptions
import dagger.hilt.android.lifecycle.HiltViewModel
import de.motis.prima.R
import de.motis.prima.data.DataRepository
import de.motis.prima.data.EventObject
import de.motis.prima.data.EventObjectGroup
import de.motis.prima.data.ValidationStatus
import de.motis.prima.ui.theme.LocalExtendedColors
import java.util.Date
import javax.inject.Inject

@HiltViewModel
class EventGroupViewModel @Inject constructor(
    private val repository: DataRepository
) : ViewModel() {
    val storedTickets = repository.storedTickets

    fun getValidCount(eventGroupId: String): Int {
        var tickets = repository.getTicketsForEventGroup(eventGroupId)
        tickets = tickets.filter { t ->
            t.validationStatus == ValidationStatus.DONE.name ||
                    t.validationStatus == ValidationStatus.CHECKED_IN.name
        }
        return tickets.size
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
                val validEvents = eventGroup.events.filter { e -> e.cancelled.not() }
                items(items = validEvents, itemContent = { event ->
                    ShowCustomerDetails(event, viewModel)
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
    viewModel: EventGroupViewModel// = hiltViewModel()
) {
    val context = LocalContext.current
    val storedTickets = viewModel.storedTickets.collectAsState()
    val fareToPay: Double = (event.ticketPrice / 100).toDouble()

    Card(
        modifier = Modifier
            .padding(top = 10.dp)
            .padding(horizontal = 10.dp),
        colors = CardColors(LocalExtendedColors.current.cardColor, Color.Black, Color.White, Color.White)
    ) {
        Column {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 8.dp, start = 12.dp, end = 12.dp),
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
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 8.dp, start = 12.dp, end = 12.dp),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(8.dp))
                        .background(if (event.isPickup) Color.Green else Color.Red),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = if (event.isPickup) Icons.AutoMirrored.Filled.ArrowForward else Icons.AutoMirrored.Filled.ArrowBack,
                        contentDescription = "Localized description",
                        tint = Color.White
                    )
                }

                Box() {
                    if (event.wheelchairs > 0) {
                        Icon(
                            painter = painterResource(id = R.drawable.ic_wheelchair),
                            contentDescription = "Localized description",
                            tint = LocalExtendedColors.current.textColor
                        )
                    }
                }

                Row {
                    Row(
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = Icons.Default.Person,
                            contentDescription = "Localized description",
                            tint = LocalExtendedColors.current.textColor
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = "${event.passengers}",
                            fontSize = 24.sp,
                            textAlign = TextAlign.Center,
                            color = LocalExtendedColors.current.textColor
                        )
                    }
                    Spacer(modifier = Modifier.width(30.dp))

                    Row(
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            painter = painterResource(id = R.drawable.ic_luggage),
                            contentDescription = "Localized description",
                            tint = LocalExtendedColors.current.textColor
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = "${event.luggage}",
                            fontSize = 24.sp,
                            textAlign = TextAlign.Center,
                            color = LocalExtendedColors.current.textColor
                        )
                    }
                    Spacer(modifier = Modifier.width(30.dp))

                    Row(
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            painter = painterResource(id = R.drawable.ic_bike),
                            contentDescription = "Localized description",
                            tint = LocalExtendedColors.current.textColor
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = "${event.bikes}",
                            fontSize = 24.sp,
                            textAlign = TextAlign.Center,
                            color = LocalExtendedColors.current.textColor
                        )
                    }
                }
            }
            Spacer(modifier = Modifier.height(20.dp))
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 24.dp)
                    .padding(bottom = 8.dp),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = event.customerName,
                    fontSize = 24.sp,
                    textAlign = TextAlign.Center,
                    color = LocalExtendedColors.current.textColor
                )
            }

            if (!event.isPickup) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 24.dp)
                        .padding(bottom = 8.dp),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = "${String.format("%.2f", fareToPay)} €",
                        fontSize = 24.sp,
                        textAlign = TextAlign.Center,
                        color = LocalExtendedColors.current.textColor
                    )
                }
            }

            if (event.isPickup) {
                Spacer(modifier = Modifier.height(20.dp))
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 20.dp)
                        .padding(bottom = 8.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
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

                    var ticketStatus: ValidationStatus = ValidationStatus.OPEN
                    val ticketObject = storedTickets.value
                        .find { t -> t.ticketHash == event.ticketHash }


                    if (ticketObject != null) {
                        ticketStatus = ValidationStatus.valueOf(ticketObject.validationStatus)
                    }

                    Text(
                        text = "${String.format("%.2f", fareToPay)} €",
                        fontSize = 24.sp,
                        textAlign = TextAlign.Center,
                        color = LocalExtendedColors.current.textColor
                    )

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