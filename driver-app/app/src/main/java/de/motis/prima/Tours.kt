package de.motis.prima

import android.util.Log
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.MoreVert
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.constraintlayout.compose.ConstraintLayout
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.navigation.NavController
import de.motis.prima.app.DriversApp
import de.motis.prima.services.Api
import de.motis.prima.services.CookieStore
import de.motis.prima.services.Tour
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.launch
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import java.text.SimpleDateFormat
import java.util.Date

class ToursViewModel : ViewModel() {
    private val cookieStore: CookieStore = CookieStore(DriversApp.instance)

    private val _logoutEvent = MutableSharedFlow<Unit>()
    val logoutEvent = _logoutEvent.asSharedFlow()

    var tours = mutableStateOf<List<Tour>>(emptyList())
        private set

    var isLoading = mutableStateOf(true)
        private set

    init {
        fetchTours()
    }

    fun fetchTours() {
        val currentDate = SimpleDateFormat("yyyy-MM-dd").format(Date())
        Log.d("date", currentDate)
        viewModelScope.launch {
            Api.apiService.getTours(currentDate).enqueue(object : Callback<List<Tour>> {
                override fun onResponse(call: Call<List<Tour>>, response: Response<List<Tour>>) {
                    if (response.isSuccessful) {
                        tours.value = response.body() ?: emptyList()
                        isLoading.value = false
                    } else {
                        isLoading.value = false
                    }
                }

                override fun onFailure(call: Call<List<Tour>>, t: Throwable) {
                    isLoading.value = false
                }
            })
        }
    }

    fun logout() {
        viewModelScope.launch {
            try {
                cookieStore.clearCookies()
                _logoutEvent.emit(Unit)
            } catch (e: Exception) {
                Log.d("Logout", "Error while logout.")
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun Tours(
    navController: NavController,
    vehiclesViewModel: VehiclesViewModel,
    viewModel: ToursViewModel
) {
    LaunchedEffect(key1 = viewModel) {
        viewModel.fetchTours()
        Log.d("fetch", "tours")
        launch {
            viewModel.logoutEvent.collect {
                Log.d("Logout", "Logout event triggered.")
                navController.navigate("login") {
                    launchSingleTop = true
                }
            }
        }
    }

    var dropdownExpanded by remember {
        mutableStateOf(false)
    }

    Scaffold(
        topBar = {
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
                    IconButton(onClick = { navController.navigate("home") }) {
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
                            text = {Text("Fahrzeug wechseln")}
                        )
                        DropdownMenuItem(
                            onClick = {
                                viewModel.logout()
                                dropdownExpanded = false

                            },
                            text = { Text("Logout") }
                        )
                    }
                }
            )

        }
    ) { contentPadding ->
        if (vehiclesViewModel.selectedVehicleId == 0) {
            Box(
                modifier = Modifier.fillMaxSize().padding(16.dp),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "Kein Fahrzeug ausgewählt",
                    fontSize = 24.sp,
                    textAlign = TextAlign.Center
                )
            }
        }

        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(contentPadding)
        ) {
            val toursForVehicle = viewModel.tours.value.filter { t ->
                t.vehicle_id == vehiclesViewModel.selectedVehicleId
            }
            Log.d("test", viewModel.tours.value.toString())
            items(items = toursForVehicle, itemContent = { tour ->
                ConstraintLayout(modifier = Modifier.clickable {
                    //navController.navigate("legs/${tour.tour_id}/0")
                    navController.navigate("overview/${tour.tour_id}")
                }) {
                    var startAddress = ""
                    var displayTime = ""
                    try {
                        val startEvent = tour.events[0]
                        startAddress = startEvent.city + ", " + startEvent.street + " " + startEvent.house_number
                    } catch (e: Exception) {
                        Log.d("error", "Error: Tour has no events")
                    }
                    try {
                        displayTime = tour.from.split("T")[1].substring(0, 5)
                    } catch (e: Exception) {
                        Log.d("error", "Error: No display time")
                    }

                    Card(
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(start = 24.dp, end = 24.dp, top = 24.dp, bottom = 0.dp)
                            .height(100.dp)
                    ) {
                        Box(
                            modifier = Modifier.fillMaxSize().padding(16.dp),
                            contentAlignment = Alignment.TopStart
                        ) {
                            Column {
                                Text(displayTime, fontSize = 24.sp, fontWeight = FontWeight.Bold)
                                Spacer(modifier = Modifier.height(12.dp))
                                Text(startAddress, fontSize = 24.sp)
                            }
                        }
                    }
                }
            })
        }
    }
}
