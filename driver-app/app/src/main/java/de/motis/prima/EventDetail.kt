package de.motis.prima

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.util.Log
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
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
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import androidx.navigation.NavOptions
import de.motis.prima.services.Event


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

fun phoneCall(number: String, context: android.content.Context) {
    val intent = Intent(Intent.ACTION_DIAL, Uri.fromParts("tel", number, null))
    context.startActivity(intent)
}

data class EventGroup(
    val id: Int,
    val events: List<Event>,
)

@Composable
fun showCustomerDetails(event: Event, context: Context, navController: NavController) {
    var firstName = "-"
    var lastName = "-"
    var phone = "-"

    try {
        if (event.first_name != null)
            firstName = event.first_name
        if (event.last_name != null)
            lastName = event.last_name
        if (event.phone != null)
            phone = event.phone
    } catch (e: Exception) {
        Log.d("error", "showCustomerDetails: Failed to read event details")
        return
    }

    Card (
        modifier = Modifier.padding(top = 10.dp).padding(horizontal = 10.dp)
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
                    modifier = Modifier.background(Color.Green)
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
                    .padding(horizontal = 24.dp),
            ) {
                Text(
                    text = "$lastName, $firstName",
                    fontSize = 24.sp,
                    textAlign = TextAlign.Center
                )
            }

            if (event.is_pickup) {
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
                }
            }
        }
    }
}

@Composable
fun EventDetail(tourId : Int, eventIndex : Int, event: Event, inStep: Boolean, currentLocation: Location, navController: NavController) {
    var scheduledTime = "-"
    var city = "-"
    var street = "-"
    var houseNumber = "-"
    var isPickup = false
    var eventLocation = Location(latitude = 0.0, longitude = 0.0)

    val context = LocalContext.current

    try {
        scheduledTime = event.scheduled_time
            .replace("T", " ")
            .toDate()
            .formatTo("HH:mm")
        if (event.city != null)
            city = event.city + ", " + event.postal_code
        if (event.street != null)
            street = event.street
        if (event.house_number != null)
            houseNumber = event.house_number
        isPickup = event.is_pickup
        if (event.latitude != null && event.longitude != null)
            eventLocation = Location(latitude = event.latitude, longitude = event.longitude)
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
        Column (modifier = Modifier.padding(10.dp) ) {
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

            if (city == "" || street == "") {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.Center
                ) {
                    Text(
                        text = "Fehler: Keine Addresse",
                        fontSize = 24.sp,
                        textAlign = TextAlign.Center
                    )
                }
            } else {
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
                if (inStep) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.Center
                    ) {
                        Text(
                            text = "$street $houseNumber",
                            fontSize = 24.sp,
                            textAlign = TextAlign.Center
                        )
                    }
                }
            }

            if (inStep && isPickup) {
                val eventGroup = EventGroup(0, listOf(event))
                Card(
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.padding(top = 20.dp)
                ) {
                    LazyColumn(
                        modifier = Modifier
                            .height(510.dp)
                            .background(color = Color.White)
                    ) {
                        items(items = eventGroup.events, itemContent = { event ->
                            showCustomerDetails(event, context, navController)
                        })
                    }
                }
            }

            if (inStep) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 8.dp),
                    horizontalArrangement = Arrangement.Center
                ) {
                    Button(
                        onClick = {
                            openGoogleMapsNavigation(currentLocation, eventLocation, context)
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

                    val navOptions = NavOptions.Builder()
                        .setEnterAnim(0)
                        .setExitAnim(0)
                        .setPopEnterAnim(0)
                        .setPopExitAnim(0)
                        .build()
                    Button(
                        onClick = { navController.navigate("scan/$tourId/$eventIndex", navOptions) },
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
