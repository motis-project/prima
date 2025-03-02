package de.motis.prima

import android.annotation.SuppressLint
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
import androidx.compose.foundation.layout.wrapContentSize
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.constraintlayout.compose.ConstraintLayout
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController
import dagger.hilt.android.lifecycle.HiltViewModel
import de.motis.prima.data.DataStoreManager
import de.motis.prima.services.ApiService
import de.motis.prima.services.Tour
import de.motis.prima.services.Vehicle
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
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
import javax.inject.Inject

@HiltViewModel
class ToursViewModel @Inject constructor(
    private val repository: DataStoreManager,
    private val apiService: ApiService
) : ViewModel() {
    private val _tours = MutableStateFlow<List<Tour>>(emptyList())
    val tours: StateFlow<List<Tour>> = _tours.asStateFlow()

    private val _displayTours = MutableStateFlow<List<Tour>>(emptyList())

    private val _loading = MutableStateFlow(false)
    val loading: StateFlow<Boolean> = _loading.asStateFlow()

    private val _networkError = MutableStateFlow(false)
    val networkError = _networkError.asStateFlow()

    private val _displayDate = MutableStateFlow(LocalDate.now())
    val displayDate = _displayDate.asStateFlow()

    private var fetchAttempts = mutableIntStateOf(0)

    init {
        refreshTours()
    }

    fun fetchTours() {
        val displayDay = _displayDate.value
        val nextDay = displayDay.plusDays(1)
        val start = displayDay.atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()
        val end = nextDay.atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()

        apiService.getTours(start, end).enqueue(object : Callback<List<Tour>> {
            override fun onResponse(
                call: Call<List<Tour>>,
                response: Response<List<Tour>>
            ) {
                if (response.isSuccessful) {
                    val newTours = response.body() ?: emptyList()
                    fetchAttempts.intValue = 1
                    _loading.value = false
                    _networkError.value = false

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
                    _tours.value = newTours
                }
            }

            override fun onFailure(call: Call<List<Tour>>, t: Throwable) {
                fetchAttempts.intValue++
                if (fetchAttempts.intValue - 3 < 0) {
                    _loading.value = true
                }
                if (fetchAttempts.intValue > 3) {
                    _loading.value = false
                    _networkError.value = true
                }
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

    fun incrementDate() {
        _displayDate.value = _displayDate.value.plusDays(1)
    }

    fun decrementDate() {
        _displayDate.value = _displayDate.value.minusDays(1)
    }

    fun getDisplayTours(selectedVehicleId: Int): StateFlow<List<Tour>> {
        val toursForVehicle = _tours.value.filter { t ->
            t.vehicleId == selectedVehicleId
        }

        val toursPast = toursForVehicle.filter { t ->
            Date(t.events.first().scheduledTimeStart).before(Date()) &&
                    t.vehicleId == selectedVehicleId
        }

        val toursFuture = toursForVehicle.filter { t ->
            Date(t.events.first().scheduledTimeStart).after(Date()) &&
                    t.vehicleId == selectedVehicleId
        }

        if (_displayDate.value.dayOfYear != LocalDate.now().dayOfYear) {
            _displayTours.value = toursPast + toursFuture
        } else {
            _displayTours.value = toursFuture
        }

        return _displayTours.asStateFlow()
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
            userViewModel.logoutEvent.collect {
                navController.navigate("login") {
                    launchSingleTop = true
                }
            }
        }
    }

    val navBack = @Composable {
        IconButton(onClick = { navController.navigate("vehicles") }) {
            Icon(
                imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                contentDescription = "Localized description"
            )
        }
    }

    val navItems = listOf(
        NavItem(
            text = stringResource(id = R.string.change_vehicles),
            action = { navController.navigate("vehicles") }
        )
    )

    //val tours by viewModel.tours.collectAsState()
    //val selectedVehicle by userViewModel.selectedVehicle.collectAsState()
    val selectedVehicle = Vehicle(1, "")
    val loading by viewModel.loading.collectAsState()
    val networkError by viewModel.networkError.collectAsState()

    val tours by viewModel.getDisplayTours(selectedVehicle.id).collectAsState()

    Scaffold(
        topBar = {
            TopBar(
                userViewModel,
                navBack,
                stringResource(id = R.string.tours_header),
                true,
                navItems
            )
        }
    ) { contentPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(contentPadding)
        ) {
            DateSelect(viewModel)
            VehicleInfo(userViewModel)

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
                ShowTours(tours, navController)
            }
        }
    }
}

@Composable
fun VehicleInfo(
    userViewModel: UserViewModel
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .padding(12.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = "vehicle",//userViewModel.selectedVehicle.collectAsState().value.licensePlate,
            fontSize = 16.sp,
            textAlign = TextAlign.Center
        )
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
                onClick = {
                    viewModel.decrementDate()
                    viewModel.fetchTours()
                },
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
                onClick = {
                    viewModel.incrementDate()
                    viewModel.fetchTours()
                },
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
    tours: List<Tour>,
    navController: NavController
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
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
            ) {
                items(items = tours, itemContent = { tour ->
                    ConstraintLayout(modifier = Modifier.clickable {
                        val requestId = tour.events[0].requestId
                        navController.navigate("scan/${tour.tourId}/$requestId")
                    }) {
                        var city = "-"
                        var displayTime = "-"
                        try {
                            val startEvent = tour.events[0]
                            if (startEvent.address != "") {
                                city = startEvent.address.split(',')[1]
                            }
                            displayTime =
                                Date(startEvent.scheduledTimeStart) // TODO: correct timestamp?
                                    .formatTo("HH:mm")
                        } catch (e: Exception) {
                            Log.d("error", "Error: Tour has no events")
                        }
                        Card(
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
