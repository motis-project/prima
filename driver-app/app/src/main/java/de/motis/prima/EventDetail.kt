package de.motis.prima

import android.content.Intent
import android.net.Uri
import android.util.Log
import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.wrapContentSize
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.Card
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
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
import de.motis.prima.services.Event

fun openGoogleMapsNavigation(latitude: Double, longitude: Double, context: android.content.Context) {
    val gmmIntentUri = Uri.parse("google.navigation:q=$latitude,$longitude")
    val mapIntent = Intent(Intent.ACTION_VIEW, gmmIntentUri)
    mapIntent.setPackage("com.google.android.apps.maps")

    if (mapIntent.resolveActivity(context.packageManager) != null) {
        context.startActivity(mapIntent)
    } else {
        Toast.makeText(context, "Google Maps is not installed.", Toast.LENGTH_SHORT).show()
    }
}

@Composable
fun EventDetail(event: Event, inStep: Boolean) {
    var scheduledTime = "-"
    var city = "-"
    var street = "-"
    var houseNumber = "-"
    var isPickup = false
    var firstName = "-"
    var lastName = "-"
    var phone = "-"
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
        if (event.first_name != null)
            firstName = event.first_name
        if (event.last_name != null)
            lastName = event.last_name
        if (event.phone != null)
            phone = event.phone
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
        Column (modifier = Modifier.padding(16.dp) ) {
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
                    modifier = Modifier.fillMaxWidth().padding(top = 12.dp),
                    horizontalArrangement = Arrangement.Center
                ) {
                    Text(
                        text = city,
                        fontSize = 24.sp,
                        textAlign = TextAlign.Center
                    )
                }
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
                if (inStep && !isPickup) {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(bottom = 4.dp, top = 12.dp),
                        horizontalArrangement = Arrangement.Center
                    ) {
                        IconButton(
                            onClick = {
                                Log.d("test", "Navigation event")
                                val lat = 0.0
                                val lng = 0.0
                                openGoogleMapsNavigation(lat, lng, context)
                            },
                            Modifier
                                .background(color = Color.White)
                                .size(width = 34.dp, height = 34.dp)
                        ) {
                            Icon(
                                painter = painterResource(id = R.drawable.compass_icon),
                                contentDescription = "Localized description"
                            )
                        }
                    }
                }
            }

            if (isPickup) {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(bottom = 4.dp, top = 12.dp),
                    horizontalArrangement = Arrangement.Center
                ) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                        contentDescription = "Localized description",
                        modifier = Modifier.background(Color.Green)
                    )
                    if (event.wheelchairs > 0) {
                        Spacer(modifier = Modifier.width(16.dp))
                        Icon(
                            painter = painterResource(id = R.drawable.ic_wheelchair),
                            contentDescription = "Localized description"
                        )
                    }

                    Spacer(modifier = Modifier.width(20.dp))
                    Text(
                        text = "$lastName, $firstName",
                        fontSize = 24.sp,
                        textAlign = TextAlign.Center
                    )
                }

                Row(
                    modifier = Modifier.fillMaxWidth().padding(bottom = 16.dp),
                    horizontalArrangement = Arrangement.Center
                ) {
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

                if (inStep) {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(bottom = 16.dp),
                        horizontalArrangement = Arrangement.Center
                    ) {
                        IconButton(
                            onClick = { Log.d("call", "Call $phone") },
                            Modifier
                                .background(color = Color.White)
                                .size(width = 34.dp, height = 34.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Call,
                                contentDescription = "Localized description",
                                Modifier.size(width = 32.dp, height = 32.dp)

                            )
                        }
                        Spacer(modifier = Modifier.width(36.dp))
                        IconButton(
                            onClick = {
                                Log.d("test", "Navigation event")
                                val lat = 0.0
                                val lng = 0.0
                                openGoogleMapsNavigation(lat, lng, context)
                            },
                            Modifier
                                .background(color = Color.White)
                                .size(width = 34.dp, height = 34.dp)
                        ) {
                            Icon(
                                painter = painterResource(id = R.drawable.compass_icon),
                                contentDescription = "Localized description"
                            )
                        }
                    }
                }
            }
        }
    }
}
