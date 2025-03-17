package de.motis.prima

import android.content.Context
import android.content.Intent
import android.net.Uri
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material.icons.filled.Done
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.navigation.NavController
import androidx.navigation.NavOptions
import dagger.hilt.android.lifecycle.HiltViewModel
import de.motis.prima.data.DataRepository
import de.motis.prima.services.Event
import de.motis.prima.data.ValidationStatus
import java.util.Date
import javax.inject.Inject

@HiltViewModel
class EventGroupViewModel @Inject constructor(
    private val repository: DataRepository
) : ViewModel() {
    fun getTicketStatus(ticketCode: String): ValidationStatus? {
        return repository.getTicketStatus(ticketCode)
    }
}

fun openGoogleMapsNavigation(to: Location, context: Context) {
    val gmmIntentUri = Uri.parse("google.navigation:q=${to.latitude},${to.longitude}")
    val mapIntent = Intent(Intent.ACTION_VIEW, gmmIntentUri)
    mapIntent.setPackage("com.google.android.apps.maps")

    // Check if Google Maps App is installed
    if (mapIntent.resolveActivity(context.packageManager) != null) {
        context.startActivity(mapIntent)
    } else {
        // Fallback to browser
        val googleMapsUrl =
            "https://www.google.com/maps/dir/?api=1&destination=${to.latitude},${to.longitude}&travelmode=driving"

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
    navController: NavController,
    eventGroup: EventGroup,
    height: Dp,
) {
    Card(
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier
            .fillMaxSize()
    ) {
        Column(
            modifier = Modifier
                .padding(10.dp)
                .fillMaxHeight()
        ) {
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

            if (eventGroup.address == "") {
                if (eventGroup.location != Location(latitude = 0.0, longitude = 0.0)) {
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
                        text = eventGroup.address,
                        fontSize = 24.sp,
                        textAlign = TextAlign.Center
                    )
                }
            }

            Card(
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier
                    .padding(top = 20.dp)
                    .height(height * 0.7f)
            ) {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(Color.White)
                ) {
                    items(items = eventGroup.events, itemContent = { event ->
                        ShowCustomerDetails(event)
                    })
                }
            }


            Row(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(top = 16.dp),
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.Bottom
            ) {
                val context = LocalContext.current
                val buttonSize = 32.dp

                Button(
                    onClick = {
                        openGoogleMapsNavigation(eventGroup.location, context)
                    }
                ) {
                    Icon(
                        painter = painterResource(id = R.drawable.ic_compass),
                        contentDescription = "Localized description",
                        Modifier
                            .size(width = buttonSize, height = buttonSize)
                    )
                }

                Spacer(modifier = Modifier.width(12.dp))

                if (eventGroup.hasPickup) {
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
                        modifier = Modifier.size(width = buttonSize, height = buttonSize)
                    ) {
                        Text(
                            text = "QR",
                            fontSize = 28.sp,
                            textAlign = TextAlign.Center
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun ShowCustomerDetails(
    event: Event,
    viewModel: EventGroupViewModel = hiltViewModel()
) {
    val context = LocalContext.current

    Card(
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
                    text = event.customerName,
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
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    if (event.customerPhone != "") {
                        Button(
                            onClick = {
                                phoneCall(event.customerPhone, context)
                            }
                        ) {
                            Icon(
                                imageVector = Icons.Default.Call,
                                contentDescription = "Localized description",
                                Modifier.size(width = 26.dp, height = 26.dp)

                            )
                        }
                    }

                    val ticketStatus = viewModel.getTicketStatus(event.ticketHash)

                    Box(
                        modifier = Modifier.padding(top = 8.dp)
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "Ticket-Validierung:  ",
                                fontSize = 20.sp,
                                textAlign = TextAlign.Center
                            )

                            if (ticketStatus == null) {
                                Icon(
                                    imageVector = Icons.Default.Clear,
                                    contentDescription = "Localized description",
                                    tint = Color.Red,
                                    modifier = Modifier
                                        .size(width = 30.dp, height = 30.dp)
                                        .background(Color.White)
                                )
                            } else if (ticketStatus == ValidationStatus.DONE) {
                                Icon(
                                    imageVector = Icons.Default.Done,
                                    contentDescription = "Localized description",
                                    tint = Color.White,
                                    modifier = Modifier
                                        .size(width = 32.dp, height = 32.dp)
                                        .background(Color.Green)
                                )
                            } else if (ticketStatus == ValidationStatus.CHECKED_IN) {
                                Icon(
                                    imageVector = Icons.Default.Done,
                                    contentDescription = "Localized description",
                                    tint = Color.Green,
                                    modifier = Modifier
                                        .size(width = 30.dp, height = 30.dp)
                                        .background(Color.White)
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}