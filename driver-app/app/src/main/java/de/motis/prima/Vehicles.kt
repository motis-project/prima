package de.motis.prima

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
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
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
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
import de.motis.prima.services.ApiService
import de.motis.prima.services.Vehicle
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import javax.inject.Inject

class VehiclesViewModel @Inject constructor(private val apiService: ApiService) : ViewModel() {
    private val _vehicles = MutableStateFlow<List<Vehicle>>(emptyList())
    val vehicles: StateFlow<List<Vehicle>> = _vehicles.asStateFlow()

    private val _loading = MutableStateFlow(false)
    val loading: StateFlow<Boolean> = _loading.asStateFlow()

    private val _networkError = MutableStateFlow(false)
    val networkError = _networkError.asStateFlow()

    init {
        viewModelScope.launch {
            _loading.value = true
            apiService.getVehicles().enqueue(object : Callback<List<Vehicle>> {
                override fun onResponse(
                    call: Call<List<Vehicle>>,
                    response: Response<List<Vehicle>>
                ) {
                    if (response.isSuccessful) {
                        _vehicles.value = response.body() ?: emptyList()
                        _loading.value = false
                    }
                }

                override fun onFailure(call: Call<List<Vehicle>>, t: Throwable) {
                    _networkError.value = true
                    _loading.value = false
                }
            })
        }
    }
}

@Composable
fun Vehicles(
    navController: NavController,
    userViewModel: UserViewModel,
    viewModel: VehiclesViewModel = viewModel()
) {
    LaunchedEffect(key1 = viewModel) {
        launch {
            userViewModel.logoutEvent.collect {
                navController.navigate("login") {
                    launchSingleTop = true
                }
            }
        }

        launch {
            userViewModel.vehicleSelectEvent.collect {
                navController.navigate("tours")
            }
        }
    }

    val vehicles by viewModel.vehicles.collectAsState()
    val loading by viewModel.loading.collectAsState()
    val networkError by viewModel.networkError.collectAsState()

    val navBack = @Composable {}
    val navItems = emptyList<NavItem>()

    Scaffold(
        topBar = {
            TopBar(
                userViewModel,
                navBack,
                stringResource(id = R.string.vehicles_header),
                true,
                navItems
            )
        }
    ) { contentPadding ->
        Column {
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
                LazyColumn(
                    modifier = Modifier
                        .padding(contentPadding)
                ) {
                    items(items = vehicles, itemContent = { vehicle ->
                        ConstraintLayout(modifier = Modifier.clickable {
                            //userViewModel.selectVehicle(vehicle)
                        }) {
                            Card(
                                shape = RoundedCornerShape(12.dp),
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(start = 24.dp, end = 24.dp, top = 24.dp, bottom = 0.dp)
                                    .height(80.dp)
                            ) {
                                Box(
                                    modifier = Modifier.fillMaxSize(),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text(
                                        vehicle.licensePlate,
                                        fontSize = 24.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                }
                            }
                        }

                    })
                }
            }
        }
    }
}

@Composable
fun ErrorInfo(
    errorMsg: String
) {
    Card(
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier
            .wrapContentSize()
            .padding(start = 24.dp, end = 24.dp)
    ) {
        Box(
            modifier = Modifier
                .padding(16.dp)
        ) {
            Column {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(10.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        painter = painterResource(id = R.drawable.ic_warning),
                        contentDescription = "Localized description",
                        Modifier
                            .size(width = 64.dp, height = 64.dp)
                    )
                }
                Spacer(Modifier.height(24.dp))
                Text(
                    text = errorMsg,
                    fontSize = 24.sp,
                    textAlign = TextAlign.Center
                )
            }
        }
    }
}
