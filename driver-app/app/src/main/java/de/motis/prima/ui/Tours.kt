package de.motis.prima.ui

import android.content.Intent
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
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonColors
import androidx.compose.material3.Card
import androidx.compose.material3.CardColors
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
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
import de.motis.prima.R
import de.motis.prima.services.Event
import de.motis.prima.services.Tour
import de.motis.prima.ui.theme.LocalExtendedColors
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
    intent: Intent?,
    viewModel: ToursViewModel = hiltViewModel()
) {
    val vehicle = viewModel.selectedVehicle.collectAsState()
    val toursToday by viewModel.toursCache.collectAsState()
    val toursDate by viewModel.toursForDate.collectAsState()
    val intentSeen by viewModel.intentSeen.collectAsState()

    intent?.let { safeIntent ->
        runCatching {
            val tourIdStr = safeIntent.getStringExtra("tourId")
            if (!intentSeen) {
                tourIdStr?.let { safeTourIdStr ->
                    viewModel.addMarker(safeTourIdStr.toInt())
                }
            }
        }
    }

    Scaffold(
        topBar = {
            TopBar(
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

            DateSelect(viewModel)

            val date by viewModel.displayDate.collectAsState()
            val today =
                LocalDate.now().atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()
            val displayDay = date.atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()

            val networkError by viewModel.networkError.collectAsState()
            if (networkError) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 20.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "offline",
                        fontSize = 16.sp,
                        textAlign = TextAlign.Center,
                        color = Color.Red
                    )
                }
            }

            val showAll by viewModel.showAll.collectAsState()

            var displayTours = toursToday

            if (networkError || displayDay != today) {
                displayTours = toursDate
            }

            if (networkError.not()) {
                if (displayDay == today && !showAll) {
                    displayTours = toursToday.filter { t ->
                        !viewModel.isCancelled(t.tourId) && Date(t.endTime) > Date() }
                }

                if (displayDay != today) {
                    displayTours = toursToday
                }
            }

            try {
                displayTours = displayTours.sortedBy { t -> t.events[0].scheduledTimeStart }
            } catch(e: Exception) {
                Log.d("error", "Error: ${e.message}")
            }

            displayTours = displayTours.filter { t -> !viewModel.isCancelled(t.tourId) }

            ShowTours(navController, displayTours)
        }
    }
}

@Composable
fun DateSelect(
    viewModel: ToursViewModel
) {
    val date by viewModel.displayDate.collectAsState()
    val showAll by viewModel.showAll.collectAsState()

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
                        .background(LocalExtendedColors.current.secondaryButton)
                        .border(
                            border = BorderStroke(2.dp, LocalExtendedColors.current.secondaryButton),
                            shape = RoundedCornerShape(6.dp)
                        ),
                    tint = LocalExtendedColors.current.textColor
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
                        .background(LocalExtendedColors.current.secondaryButton)
                        .border(
                            border = BorderStroke(2.dp, LocalExtendedColors.current.secondaryButton),
                            shape = RoundedCornerShape(6.dp)
                        ),
                    tint = LocalExtendedColors.current.textColor
                )
            }
        }
    }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 12.dp, bottom = 20.dp),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically
    ) {
        if (date != LocalDate.now()) {
            Button(
                onClick = {
                    viewModel.resetDate()
                },
                modifier = Modifier
                    .size(width = 100.dp, height = 36.dp),
                colors = ButtonColors(
                    containerColor = LocalExtendedColors.current.secondaryButton,
                    contentColor = LocalExtendedColors.current.textColor,
                    disabledContainerColor = Color.White,
                    disabledContentColor = Color.White
                )
            ) {
                Text(
                    text = "Heute", fontSize = 16.sp
                )
            }
        } else {
            Switch(
                checked = !showAll,
                onCheckedChange = { viewModel.setShowAll(!it) }
            )
            Text(
                text = "Nur ausstehende",
                modifier = Modifier.padding(start = 8.dp),
                fontSize = 16.sp
            )
        }
    }
}

@Composable
fun ToursList(
    navController: NavController,
    tours: List<Tour>,
    viewModel: ToursViewModel = hiltViewModel()
) {
    LaunchedEffect(Unit) {
        for (tour in tours) {
            viewModel.updateEventGroups(tour.tourId)
        }
    }

    val loading by viewModel.loading.collectAsState()
    val markedTour by viewModel.markedTour.collectAsState()

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(LocalExtendedColors.current.containerColor)
    ) {
        items(items = tours, itemContent = { tour ->
            ConstraintLayout(modifier = Modifier.clickable {
                if (!loading) {
                    navController.navigate("preview/${tour.tourId}")
                    viewModel.removeMarker()
                }
            }) {
                var startEvent: Event? = null
                try {
                    startEvent = tour.events[0] // TODO: get from first eventGroup
                } catch (e: Exception) {
                    Log.d("error", "Error: Tour has no events")
                }

                val address = startEvent?.address ?: ""

                var  city = ""
                try {
                    val split = address.split(',')
                    city = if (split[1] == " Deutschland") {
                        split[0]
                    } else {
                        split[1]
                    }
                } catch (e: Exception) {
                    city = address
                }

                val scheduledTime = startEvent?.scheduledTime ?: 0
                val scheduledTimeStart = startEvent?.scheduledTimeStart ?: 0

                val displayTime = if (scheduledTime.toInt() != 0) {
                    Date(scheduledTime)
                        .formatTo("HH:mm")
                } else if (scheduledTimeStart.toInt() != 0) {
                    Date(scheduledTimeStart)
                        .formatTo("HH:mm")
                } else {
                    ""
                }

                var cardColor = LocalExtendedColors.current.cardColor
                if (markedTour == tour.tourId) {
                    cardColor = LocalExtendedColors.current.markedCardColor
                }

                Card(
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(10.dp)
                        .wrapContentSize(),
                    colors = CardColors(cardColor, Color.Black, Color.White, Color.White)
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
                                textAlign = TextAlign.Center,
                                color = LocalExtendedColors.current.textColor
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
                                textAlign = TextAlign.Center,
                                color = LocalExtendedColors.current.textColor
                            )
                        }

                        if (viewModel.isCancelled(tour.tourId)) {
                            Spacer(modifier = Modifier.height(10.dp))
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(top = 12.dp),
                                horizontalArrangement = Arrangement.Center
                            ) {
                                Text(
                                    text = "Storniert",
                                    fontSize = 24.sp,
                                    textAlign = TextAlign.Center,
                                    color = Color.Red
                                )
                            }
                        }

                        val now = Date()
                        val tourDate = Date(tour.endTime)
                        if (tourDate < now) {
                            val ticketChecked =
                                tour.events.any { e -> e.ticketChecked }

                            Spacer(modifier = Modifier.height(40.dp))

                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(horizontal = 30.dp),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text(
                                    text = stringResource(id = R.string.tickets_validated),
                                    fontSize = 20.sp,
                                    textAlign = TextAlign.Center,
                                    color = LocalExtendedColors.current.textColor
                                )

                                if (ticketChecked) {
                                    Icon(
                                        imageVector = Icons.Default.Done,
                                        contentDescription = "Localized description",
                                        tint = Color.Green,
                                        modifier = Modifier
                                            .size(width = 32.dp, height = 32.dp)
                                            .background(LocalExtendedColors.current.containerColor)
                                    )
                                } else {
                                    Icon(
                                        imageVector = Icons.Default.Clear,
                                        contentDescription = "Localized description",
                                        tint = Color.Red,
                                        modifier = Modifier
                                            .size(width = 32.dp, height = 32.dp)
                                            .background(LocalExtendedColors.current.containerColor)
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
                                    text = stringResource(id = R.string.fare_label),
                                    fontSize = 20.sp,
                                    textAlign = TextAlign.Center,
                                    color = LocalExtendedColors.current.textColor
                                )

                                if (tour.fare != 0) {
                                    Icon(
                                        imageVector = Icons.Default.Done,
                                        contentDescription = "Localized description",
                                        tint = if (ticketChecked) Color.Green else Color.Gray,
                                        modifier = Modifier
                                            .size(width = 32.dp, height = 32.dp)
                                            .background(LocalExtendedColors.current.containerColor)
                                    )
                                } else {
                                    Icon(
                                        imageVector = Icons.Default.Clear,
                                        contentDescription = "Localized description",
                                        tint = Color.Red,
                                        modifier = Modifier
                                            .size(width = 32.dp, height = 32.dp)
                                            .background(LocalExtendedColors.current.containerColor)
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

@Composable
fun ShowTours(
    navController: NavController,
    tours: List<Tour>,
    viewModel: ToursViewModel = hiltViewModel()
) {
    Card(
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier.padding(10.dp).fillMaxSize(),
        colors = CardColors(LocalExtendedColors.current.containerColor, Color.Black, Color.White, Color.White)
    ) {
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
                    textAlign = TextAlign.Center,
                    color = LocalExtendedColors.current.textColor
                )
            }
        } else {
            ToursList(navController, tours, viewModel)
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
