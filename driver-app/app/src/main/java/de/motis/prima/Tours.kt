package de.motis.prima

import android.content.res.Resources
import android.graphics.drawable.Drawable
import android.util.Log
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
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
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material.icons.filled.Done
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.constraintlayout.compose.ConstraintLayout
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavController
import de.motis.prima.services.Event
import de.motis.prima.services.Tour
import de.motis.prima.viewmodel.ToursViewModel
import java.text.SimpleDateFormat
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Date
import java.util.Locale
import java.util.TimeZone

@Composable
fun Tours(
    navController: NavController,
    viewModel: ToursViewModel = hiltViewModel()
) {
    val loading by viewModel.loading.collectAsState()
    val networkError by viewModel.networkError.collectAsState()
    val vehicle = viewModel.selectedVehicle.collectAsState()
    val tours by viewModel.toursCache.collectAsState()


    Scaffold(
        topBar = {
            TopBar(
                "vehicles",
                stringResource(id = R.string.tours_header),
                true,
                listOf(
                    NavItem(
                        text = stringResource(id = R.string.change_vehicles),
                        action = { navController.navigate("vehicles") }
                    )
                ),
                navController
            )
        }
    ) { contentPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(contentPadding)
        ) {
            DateSelect(viewModel)

            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(12.dp),
                contentAlignment = Alignment.Center
            ) {
                vehicle.value?.let {
                    Text(
                        text = it.licensePlate,
                        fontSize = 16.sp,
                        textAlign = TextAlign.Center
                    )
                }
            }

            if (loading) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(contentPadding),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator()
                }
            } else if (networkError) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(contentPadding),
                    contentAlignment = Alignment.Center
                ) {
                    ErrorInfo(stringResource(id = R.string.network_error))
                }
            } else {
                ShowTours(navController, tours)
            }
        }
    }
}

@Composable
fun DateSelect(
    viewModel: ToursViewModel
) {
    val date by viewModel.displayDate.collectAsState()

    Row(
        modifier = Modifier
            .fillMaxWidth(),
        horizontalArrangement = Arrangement.Center
    ) {
        Box(
            modifier = Modifier
                .padding(all = 6.dp),

            ) {
            IconButton(
                onClick = { viewModel.decrementDate() },
                Modifier
                    .size(width = 48.dp, height = 24.dp)
            ) {
                Icon(
                    imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                    contentDescription = "Localized description",
                    modifier = Modifier
                        .size(width = 48.dp, height = 24.dp)
                        .background(Color.LightGray)
                        .border(
                            border = BorderStroke(2.dp, Color.LightGray),
                            shape = RoundedCornerShape(6.dp)
                        )
                )
            }
        }
        Box(
            modifier = Modifier
                .padding(all = 6.dp),

            ) {
            Text(
                text = date.format(DateTimeFormatter.ofPattern("dd.MM.yyyy")),
                fontSize = 24.sp,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center
            )
        }
        Box(
            modifier = Modifier
                .padding(all = 6.dp),

            ) {
            IconButton(
                onClick = { viewModel.incrementDate() },
                Modifier
                    .size(width = 48.dp, height = 24.dp)
            ) {
                Icon(
                    imageVector = Icons.AutoMirrored.Filled.ArrowForward,
                    contentDescription = "Localized description",
                    modifier = Modifier
                        .size(width = 48.dp, height = 24.dp)
                        .background(Color.LightGray)
                        .border(
                            border = BorderStroke(2.dp, Color.LightGray),
                            shape = RoundedCornerShape(6.dp)
                        )
                )
            }
        }
    }
}

@Composable
fun ShowTours(
    navController: NavController,
    tours: List<Tour>,
    viewModel: ToursViewModel = hiltViewModel()
) {
    Row {
        if (tours.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(24.dp),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = stringResource(id = R.string.no_tours),
                    fontSize = 24.sp,
                    textAlign = TextAlign.Center
                )
            }
        } else {
            val loading by viewModel.loading.collectAsState()
            val date by viewModel.displayDate.collectAsState()
            val today = LocalDate.now().atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()
            val displayDay = date.atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()

            var displayTours = tours
            if (today != displayDay) {
                displayTours = viewModel.getToursForDate()
            }

            displayTours = displayTours.filter { t ->
                t.vehicleId == viewModel.selectedVehicle.value?.id
            }
            displayTours = displayTours.sortedBy { t -> t.events[0].scheduledTimeStart }

            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
            ) {
                items(items = displayTours, itemContent = { tour ->
                    ConstraintLayout(modifier = Modifier.clickable {
                        viewModel.updateEventGroups(tour.tourId)
                        if (!loading)
                            navController.navigate("preview/${tour.tourId}")
                    }) {
                        val city: String
                        val displayTime: String
                        val address: String

                        var startEvent: Event? = null
                        try {
                            startEvent = tour.events[0]
                        } catch (e: Exception) {
                            Log.d("error", "Error: Tour has no events")
                        }

                        address = startEvent?.address ?: ""
                        city = try {
                            address.split(',')[1]
                        } catch (e: Exception) {
                            address
                        }

                        val start = startEvent?.scheduledTimeStart ?: 0
                        displayTime = if (start.toInt() != 0) {
                            Date(start)
                                .formatTo("HH:mm")
                        } else {
                            ""
                        }

                        /*Card(
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(start = 24.dp, end = 24.dp, top = 24.dp, bottom = 0.dp)
                                .wrapContentSize()
                        ) {
                            Box(
                                modifier = Modifier
                                    .fillMaxSize()
                                    .padding(16.dp),
                                contentAlignment = Alignment.TopStart
                            ) {
                                Column {
                                    Text(
                                        displayTime,
                                        fontSize = 24.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                    Spacer(modifier = Modifier.height(12.dp))
                                    if (city != "-") {
                                        Text(
                                            city,
                                            fontSize = 24.sp
                                        )
                                    } else {
                                        Text(
                                            text = stringResource(id = R.string.no_adress),
                                            fontSize = 24.sp
                                        )
                                        Spacer(modifier = Modifier.height(12.dp))
                                        Text(
                                            text = stringResource(id = R.string.navi_available),
                                            fontSize = 24.sp
                                        )
                                    }
                                }
                            }
                        }*/

                        Card(
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(start = 24.dp, end = 24.dp, bottom = 24.dp)
                                .wrapContentSize()
                        ) {
                            Column(
                                modifier = Modifier.padding(10.dp),
                            ) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.Center
                                ) {
                                    Text(
                                        text = displayTime,
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

                                val now = Date()
                                val tourDate = Date(tour.endTime)
                                if (tourDate < now) {
                                    Spacer(modifier = Modifier.height(40.dp))

                                    //
                                    Row(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(horizontal = 30.dp),
                                        horizontalArrangement = Arrangement.SpaceBetween
                                    ) {
                                        Text(
                                            text = "Status:",
                                            fontSize = 24.sp,
                                            textAlign = TextAlign.Center
                                        )
                                        Row {
                                            Icon(
                                                imageVector = Icons.Default.Done,
                                                contentDescription = "Localized description",
                                                tint = Color.Green,
                                                modifier = Modifier
                                                    .size(width = 26.dp, height = 26.dp)
                                                    .background(Color.White)
                                            )
                                            IconButton(
                                                onClick = {  },
                                                modifier = Modifier.size(48.dp)
                                            ) {
                                                Icon(imageVector = Icons.Default.KeyboardArrowDown, contentDescription = "More Options")
                                            }
                                        }
                                    }

                                    Row(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(horizontal = 30.dp),
                                        horizontalArrangement = Arrangement.SpaceBetween
                                    ) {
                                        Text(
                                            text = "Tickets validiert:",
                                            fontSize = 24.sp,
                                            textAlign = TextAlign.Center
                                        )

                                        val ticketChecked = tour.events.filter { e -> e.ticketChecked }
                                        if (ticketChecked.isNotEmpty()) {
                                            Icon(
                                                imageVector = Icons.Default.Done,
                                                contentDescription = "Localized description",
                                                tint = Color.Green,
                                                modifier = Modifier
                                                    .size(width = 32.dp, height = 32.dp)
                                                    .background(Color.White)
                                            )
                                        } else {
                                            Icon(
                                                imageVector = Icons.Default.Clear,
                                                contentDescription = "Localized description",
                                                tint = Color.Red,
                                                modifier = Modifier
                                                    .size(width = 32.dp, height = 32.dp)
                                                    .background(Color.White)
                                            )
                                        }
                                    }

                                    Spacer(modifier = Modifier.height(10.dp))
                                    Row(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(horizontal = 30.dp),
                                        horizontalArrangement = Arrangement.SpaceBetween
                                    ) {
                                        Text(
                                            text = "Fahrpreis übermittelt:",
                                            fontSize = 24.sp,
                                            textAlign = TextAlign.Center
                                        )

                                        if (tour.fare != 0) {
                                            Icon(
                                                imageVector = Icons.Default.Done,
                                                contentDescription = "Localized description",
                                                tint = Color.Green,
                                                modifier = Modifier
                                                    .size(width = 32.dp, height = 32.dp)
                                                    .background(Color.White)
                                            )
                                        } else {
                                            Icon(
                                                imageVector = Icons.Default.Clear,
                                                contentDescription = "Localized description",
                                                tint = Color.Red,
                                                modifier = Modifier
                                                    .size(width = 32.dp, height = 32.dp)
                                                    .background(Color.White)
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }
                })
            }
        }
    }
}

fun Date.formatTo(
    dateFormat: String,
    timeZone: TimeZone = TimeZone.getTimeZone("Europe/Berlin")
): String {
    var res = String()
    try {
        val formatter = SimpleDateFormat(
            dateFormat, Locale.getDefault()
        )
        formatter.timeZone = timeZone
        res = formatter.format(this)
    } catch (e: Exception) {
        Log.d("error", e.message.toString())
    }
    return res
}
