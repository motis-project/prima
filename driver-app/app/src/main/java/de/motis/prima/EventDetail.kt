package de.motis.prima

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
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModel
import androidx.navigation.NavController
import androidx.navigation.NavOptions
import de.motis.prima.services.Event
import de.motis.prima.services.Tour
import java.util.Date

class EventDetailViewModel : ViewModel() {
    var eventGroup = mutableStateOf<List<Event>>(emptyList<Event>())

    private fun buildEventGroup(events: List<Event>) {
        for (event in events) {
            Log.d("test", event.customer_id)
        }
    }

    init {
        // TODO
    }

    fun reset() {
        // TODO
    }
}

@Composable
fun EventDetail(
    tourId : Int,
    eventIndex : Int,
    event: Event,
    inStep: Boolean,
    currentLocation: Location,
    ticket: String,
    navController: NavController,
    viewModel: EventDetailViewModel = EventDetailViewModel()
) {
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
                Card(
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.padding(top = 20.dp)
                ) {
                    LazyColumn(
                        modifier = Modifier
                            .height(510.dp)
                            .background(color = Color.White)
                    ) {
                        items(items = viewModel.eventGroup.value, itemContent = { event ->
                            ShowCustomerDetails(event, ticket, context, navController)
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



private fun reportTicketScan(ticket: String) {
    Log.d("test", "Ticket scanned: $ticket")
}
