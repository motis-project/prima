package de.motis.prima

import android.content.Context
import android.content.Intent
import android.health.connect.datatypes.HeightRecord
import android.net.Uri
import android.util.Log
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.wrapContentSize
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController
import androidx.navigation.NavOptions
import de.motis.prima.services.Event
import java.util.Date

class EventGroupViewModel(var stopIndex: Int, tour: TourViewModel) : ViewModel() {
    var scheduledTime = "-"
    var city = "-"
    var stopDesc = "-"
    var hasPickup = false
    var eventLocation = Location(latitude = 0.0, longitude = 0.0)
    var tourId = tour.id_
    var eventGroup = tour.eventGroups[stopIndex]

    init {
        try {
            val event = eventGroup.events.first()
            stopDesc = event.address
            scheduledTime = Date(event.scheduledTimeStart).formatTo("HH:mm")
            val parts = event.address.split(',')
            if (parts.size == 2) {
                city = parts[1]
                stopDesc = parts[0]
            }
            val pickupEvent = eventGroup.events.find { e -> e.isPickup }
            hasPickup = (pickupEvent != null)
            eventLocation = Location(latitude = event.lat, longitude = event.lng)
        } catch (e: Exception) {
            Log.d("error", "EventGroup: failed to read event details")
        }
    }
}

fun openGoogleMapsNavigation(from: Location, to: Location, context: android.content.Context) {
    val gmmIntentUri = Uri.parse("google.navigation:q=${to.latitude},${to.longitude}")
    val mapIntent = Intent(Intent.ACTION_VIEW, gmmIntentUri)
    mapIntent.setPackage("com.google.android.apps.maps")

    // Check if Google Maps App is installed
    if (mapIntent.resolveActivity(context.packageManager) != null) {
        context.startActivity(mapIntent)
    } else {
        // Fallback to browser
        val googleMapsUrl =
            "https://www.google.com/maps/dir/?api=1&origin=${from.latitude},${from.longitude}&destination=${to.latitude},${to.longitude}&travelmode=driving"

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

fun phoneCall(number: String, context: Context) {
    val intent = Intent(Intent.ACTION_DIAL, Uri.fromParts("tel", number, null))
    context.startActivity(intent)
}

@Composable
fun EventGroup(
    viewModel: EventGroupViewModel,
    navController: NavController,
    height: Dp,
    scanViewModel: ScanViewModel = viewModel(),
    locationViewModel: LocationViewModel = viewModel(),
) {
    val context = LocalContext.current

    Card(
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier
            .fillMaxWidth()
            .fillMaxHeight()
    ) {
        Column (modifier = Modifier.padding(10.dp).fillMaxHeight() ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.Center
            ) {
                Text(
                    text = viewModel.scheduledTime,
                    fontWeight = FontWeight.Bold,
                    fontSize = 24.sp,
                    textAlign = TextAlign.Center
                )
            }

            if (viewModel.city == "-") {
                if (viewModel.eventLocation != Location(latitude = 0.0, longitude = 0.0)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.Center
                    ) {
                        Text(
                            text = "GPS Navigation",
                            fontSize = 24.sp,
                            textAlign = TextAlign.Center
                        )
                    }
                } else {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.Center
                    ) {
                        Text(
                            text = "Fehler: Keine Navigation möglich",
                            fontSize = 24.sp,
                            textAlign = TextAlign.Center
                        )
                    }
                }
            } else {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 12.dp),
                    horizontalArrangement = Arrangement.Center
                ) {
                    Text(
                        text = viewModel.city,
                        fontSize = 24.sp,
                        textAlign = TextAlign.Center
                    )
                }
                Spacer(modifier = Modifier.height(8.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.Center
                ) {
                    Text(
                        text = viewModel.stopDesc,
                        fontSize = 24.sp,
                        textAlign = TextAlign.Center
                    )
                }
            }

            Card(
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.padding(top = 20.dp).height(height * 0.75f)
            ) {
                LazyColumn(
                    modifier = Modifier
                        .height(height * 0.75f)
                        .background(Color.White)
                ) {
                    items(items = viewModel.eventGroup.events, itemContent = { event ->
                        ShowCustomerDetails(event, scanViewModel, context)
                    })
                }
            }

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(height * 0.25f)
                    .padding(top = 16.dp),
                horizontalArrangement = Arrangement.Center
            ) {
                Button(
                    onClick = {
                        openGoogleMapsNavigation(
                            locationViewModel.currentLocation,
                            viewModel.eventLocation, context)
                    }
                ) {
                    Icon(
                        painter = painterResource(id = R.drawable.compass_icon),
                        contentDescription = "Localized description",
                        Modifier
                            .size(width = 32.dp, height = 32.dp)
                    )
                }

                Spacer(modifier = Modifier.width(12.dp))

                if (viewModel.hasPickup) {
                    val navOptions = NavOptions.Builder()
                        .setEnterAnim(0)
                        .setExitAnim(0)
                        .setPopEnterAnim(0)
                        .setPopExitAnim(0)
                        .build()
                    Button(
                        onClick = {
                            navController.navigate("scan/${viewModel.tourId}/${viewModel.stopIndex}", navOptions)
                        },
                    ) {
                        Text(
                            text = "QR",
                            fontSize = 27.sp,
                            textAlign = TextAlign.Center
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun ShowCustomerDetails(event: Event, scanViewModel: ScanViewModel, context: Context) {
    val customerName: String
    val phone: String

    try {
        customerName = event.customerName
        phone = event.customerPhone
    } catch (e: Exception) {
        Log.d("error", "ShowCustomerDetails: Failed to read event details")
        return
    }

    val validTickets by scanViewModel.validTickets.collectAsState()

    Card (
        modifier = Modifier
            .padding(top = 10.dp)
            .padding(horizontal = 10.dp)
    ) {
        Column {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 8.dp),
                horizontalArrangement = Arrangement.Center
            ) {
                Icon(
                    imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                    contentDescription = "Localized description",
                    modifier = Modifier.background(
                        if (event.isPickup) Color.Green else Color.Red
                    )
                )
                if (event.wheelchairs > 0) {
                    Spacer(modifier = Modifier.width(12.dp))
                    Icon(
                        painter = painterResource(id = R.drawable.ic_wheelchair),
                        contentDescription = "Localized description"
                    )
                }
                Spacer(modifier = Modifier.width(20.dp))
                Icon(
                    imageVector = Icons.Default.Person,
                    contentDescription = "Localized description"
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "${event.passengers}",
                    fontSize = 24.sp,
                    textAlign = TextAlign.Center
                )
                Spacer(modifier = Modifier.width(36.dp))
                Icon(
                    painter = painterResource(id = R.drawable.ic_luggage),
                    contentDescription = "Localized description"
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "${event.luggage}",
                    fontSize = 24.sp,
                    textAlign = TextAlign.Center
                )
                Spacer(modifier = Modifier.width(36.dp))
                Icon(
                    painter = painterResource(id = R.drawable.ic_bike),
                    contentDescription = "Localized description"
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "${event.bikes}",
                    fontSize = 24.sp,
                    textAlign = TextAlign.Center
                )
            }
            Spacer(modifier = Modifier.height(20.dp))
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 24.dp)
                    .padding(bottom = 8.dp),
            ) {
                Text(
                    text = customerName,
                    fontSize = 24.sp,
                    textAlign = TextAlign.Center
                )
            }

            if (event.isPickup) {
                Spacer(modifier = Modifier.height(20.dp))
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 20.dp)
                        .padding(bottom = 4.dp),
                ) {
                    Button(
                        onClick = { phoneCall(phone, context) },
                    ) {
                        Icon(
                            imageVector = Icons.Default.Call,
                            contentDescription = "Localized description",
                            Modifier.size(width = 26.dp, height = 26.dp)

                        )
                    }
                    Spacer(modifier = Modifier.width(200.dp))

                    val ticketCode = validTickets[event.ticketHash]
                    if (ticketCode != null) {
                        Box(
                            modifier = Modifier.padding(top = 8.dp)
                        ) {
                            Icon(
                                painter = painterResource(id = R.drawable.ic_check),
                                contentDescription = "Localized description",
                                Modifier
                                    .size(width = 36.dp, height = 36.dp)
                                    .background(color = Color.Green)

                            )
                        }
                        scanViewModel.reportTicketScan(event.requestId, ticketCode)
                    } else {
                        Box(
                            modifier = Modifier.padding(top = 8.dp)
                        ) {
                            Icon(
                                painter = painterResource(id = R.drawable.ic_hourglass),
                                contentDescription = "Localized description",
                                Modifier.size(width = 36.dp, height = 36.dp)

                            )
                        }
                    }
                }
            }
        }
    }
}