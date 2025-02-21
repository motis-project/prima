package de.motis.prima

import android.util.Log
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
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
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.constraintlayout.compose.ConstraintLayout
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController
import de.motis.prima.services.Api
import de.motis.prima.services.Vehicle
import kotlinx.coroutines.launch
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response

class VehiclesViewModel() : ViewModel() {
    var vehicles = mutableStateOf<List<Vehicle>>(emptyList())

    var isLoading = mutableStateOf(true)
        private set

    fun fetchVehicles() {
        viewModelScope.launch {
            Api.apiService.getVehicles().enqueue(object : Callback<List<Vehicle>> {
                override fun onResponse(call: Call<List<Vehicle>>, response: Response<List<Vehicle>>) {
                    if (response.isSuccessful) {
                        vehicles.value = response.body() ?: emptyList()
                        isLoading.value = false
                    } else {
                        isLoading.value = false
                    }
                }

                override fun onFailure(call: Call<List<Vehicle>>, t: Throwable) {
                    isLoading.value = false
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
        viewModel.fetchVehicles()

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

    Scaffold(
        topBar = { TopBar(userViewModel) }
    ) { contentPadding ->
        LazyColumn(
            modifier = Modifier
                .padding(contentPadding)
        ) {
            items(items = viewModel.vehicles.value, itemContent = { vehicle ->
                ConstraintLayout(modifier = Modifier.clickable {
                    userViewModel.selectVehicle(vehicle)
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
                            Text(vehicle.licensePlate, fontSize = 24.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }

            })
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TopBar(
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
                text = stringResource(id = R.string.vehicles_header),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
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
                        userViewModel.logout()
                        dropdownExpanded = false

                    },
                    text = { Text(text = stringResource(id = R.string.logout)) }
                )
            }
        }
    )
}
