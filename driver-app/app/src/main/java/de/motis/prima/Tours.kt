package de.motis.prima

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.util.Log
import androidx.compose.foundation.background
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
import androidx.compose.foundation.layout.wrapContentSize
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CenterAlignedTopAppBar
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.constraintlayout.compose.ConstraintLayout
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController
import de.motis.prima.app.DriversApp
import de.motis.prima.services.Api
import de.motis.prima.services.Tour
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.launch
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import java.text.SimpleDateFormat
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Date
import java.util.Locale
import java.util.TimeZone

class ToursViewModel : ViewModel() {
    var tours = mutableStateOf<List<Tour>>(emptyList())
        private set

    var isLoading = mutableStateOf(true)
        private set

    var displayDate = MutableStateFlow(LocalDate.now())

    var showAllTours = mutableStateOf(false)

    init {
        refreshTours()
    }

    fun reset() {
        displayDate.value = LocalDate.now()
        tours = mutableStateOf(emptyList())
        showAllTours = mutableStateOf(false)
    }

    fun fetchTours() {
        val today = displayDate.value
        val tomorrow = today.plusDays(1)
        val start = today.atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()
        val end = tomorrow.atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()
        Api.apiService.getTours(start, end).enqueue(object : Callback<List<Tour>> {
            override fun onResponse(
                call: Call<List<Tour>>,
                response: Response<List<Tour>>
            ) {
                if (response.isSuccessful) {
                    val newTours = response.body() ?: emptyList()
                    isLoading.value = false

                    // Check for new items and trigger notification
                    if (tours.value.isNotEmpty() && newTours.size > tours.value.size) {
                        val newItem = newTours.last()
                        val pickup = newItem.events.first()
                        val currentDday = Date().formatTo("yyyy-MM-dd")
                        val pickupDate = Date(pickup.scheduledTimeStart)

                        if (pickupDate.formatTo("yyyy-MM-dd") == currentDday) {
                            Log.d("tours", "new tour")
                        }
                    }
                    tours.value = newTours
                } else {
                    isLoading.value = false
                }
            }

            override fun onFailure(call: Call<List<Tour>>, t: Throwable) {
                isLoading.value = false
            }
        })
    }

    private fun refreshTours() {
        viewModelScope.launch {
            while (true) {
                fetchTours()
                delay(5000) // Fetch every 5 seconds
            }
        }
    }
}

@SuppressLint("StateFlowValueCalledInComposition")
@Composable
fun Tours(
    navController: NavController,
    userViewModel: UserViewModel,
    viewModel: ToursViewModel = viewModel()
) {
    LaunchedEffect(key1 = viewModel) {
        launch {
            viewModel.fetchTours()

            userViewModel.logoutEvent.collect {
                Log.d("Logout", "Logout event triggered.")
                navController.navigate("login") {
                    launchSingleTop = true
                }
            }
        }
    }

    Scaffold(
        topBar = { TopBar(navController, userViewModel) }
    ) { contentPadding ->
        val toursForVehicle = viewModel.tours.value.filter { t ->
            t.vehicleId == userViewModel.selectedVehicle.value.id
        }

        val toursPast = toursForVehicle.filter { t ->
            Date(t.events.first().scheduledTimeStart).before(Date()) &&
                    t.vehicleId == userViewModel.selectedVehicle.value.id
        }

        val toursFuture = toursForVehicle.filter { t ->
            Date(t.events.first().scheduledTimeStart).after(Date()) &&
                    t.vehicleId == userViewModel.selectedVehicle.value.id
        }

        Column {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(contentPadding),
                horizontalArrangement = Arrangement.Center
            ) {
                showTours(tours = toursPast + toursFuture, navController = navController)
            }

        }
    }
}

@Composable
fun showTours(tours: List<Tour>, navController: NavController) {
    Row {
        if (tours.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "Keine Aufträge",
                    fontSize = 24.sp,
                    textAlign = TextAlign.Center
                )
            }
        } else {
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
            ) {
                items(items = tours, itemContent = { tour ->
                    ConstraintLayout(modifier = Modifier.clickable {
                        navController.navigate("tour/${tour.tourId}")
                    }) {
                        var city = "-"
                        var displayTime = "-"
                        try {
                            val startEvent = tour.events[0]
                            if (startEvent.address != "") {
                                city = startEvent.address.split(',')[1]
                            }
                            displayTime = Date(startEvent.scheduledTimeStart) // TODO: correct timestamp?
                                .formatTo("HH:mm")
                        } catch (e: Exception) {
                            Log.d("error", "Error: Tour has no events")
                        }
                        Card(
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(start = 24.dp, end = 24.dp, bottom = 24.dp)
                                .wrapContentSize()
                        ) {
                            Box(
                                modifier = Modifier
                                    .fillMaxSize()
                                    .padding(16.dp),
                                contentAlignment = Alignment.TopStart
                            ) {
                                Column {
                                    Text(displayTime, fontSize = 24.sp, fontWeight = FontWeight.Bold)
                                    Spacer(modifier = Modifier.height(12.dp))
                                    if (city != "-") {
                                        Text(city, fontSize = 24.sp)
                                    } else {
                                        Text("Keine Adresse", fontSize = 24.sp)
                                        Spacer(modifier = Modifier.height(12.dp))
                                        Text("GPS Navigation verfügbar", fontSize = 24.sp)
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

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TopBar(
    navController: NavController,
    userViewModel: UserViewModel
) {
    var dropdownExpanded by remember {
        mutableStateOf(false)
    }

    CenterAlignedTopAppBar(
        colors = TopAppBarDefaults.centerAlignedTopAppBarColors(
            containerColor = MaterialTheme.colorScheme.primaryContainer,
            titleContentColor = MaterialTheme.colorScheme.primary,
        ),
        title = {
            Text(
                "Aufträge",
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        },
        navigationIcon = {
            IconButton(onClick = { navController.navigate("vehicles") }) {
                Icon(
                    imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                    contentDescription = "Localized description"
                )
            }
        },
        actions = {
            IconButton(onClick = { dropdownExpanded = !dropdownExpanded }) {
                Icon(Icons.Filled.MoreVert, contentDescription = "More Options")
            }
            DropdownMenu(
                expanded = dropdownExpanded,
                onDismissRequest = { dropdownExpanded = false }
            ) {
                DropdownMenuItem(
                    onClick = {
                        dropdownExpanded = false
                        navController.navigate("vehicles")

                    },
                    text = { Text("Fahrzeug wechseln") }
                )
                DropdownMenuItem(
                    onClick = {
                        userViewModel.logout()
                        dropdownExpanded = false

                    },
                    text = { Text("Logout") }
                )
            }
        }
    )
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
