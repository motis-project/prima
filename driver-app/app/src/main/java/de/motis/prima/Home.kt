package de.motis.prima

import android.util.Log
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material3.Button
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
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.navigation.NavController
import de.motis.prima.app.DriversApp
import de.motis.prima.services.CookieStore
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.launch

class HomeViewModel : ViewModel() {
    private val cookieStore: CookieStore = CookieStore(DriversApp.instance)

    private val _logoutEvent = MutableSharedFlow<Unit>()
    val logoutEvent = _logoutEvent.asSharedFlow()

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
fun Home(
    navController: NavController,
    vehiclesViewModel: VehiclesViewModel,
    viewModel: HomeViewModel = androidx.lifecycle.viewmodel.compose.viewModel()
) {
    LaunchedEffect(key1 = viewModel) {
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
                        "Home",
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
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            Spacer(modifier = Modifier.height(42.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.Center
            ) {
                if (vehiclesViewModel.selectedVehicleId == 0) {
                    Button(
                        modifier = Modifier.width(300.dp),
                        onClick = {
                            navController.navigate("vehicles") {}
                        }
                    ) {
                        Text(
                            text = "Fahrzeug auswählen",
                            fontSize = 24.sp,
                            textAlign = TextAlign.Center
                        )
                    }
                } else {
                    var licensePlate = ""
                    try {
                        val vehicle = vehiclesViewModel.vehicles.value.filter {
                                v -> v.id == vehiclesViewModel.selectedVehicleId
                        }[0]
                        licensePlate = vehicle.plate
                    } catch (e: Exception) {
                        licensePlate = "Kein Fahrzeug ausgewählt"
                    }

                    Box() {
                        Text(
                            text = licensePlate,
                            fontWeight = FontWeight.Bold,
                            fontSize = 24.sp,
                            textAlign = TextAlign.Center
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(36.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.Center
            ) {
                Button(
                    modifier = Modifier.width(300.dp),
                    onClick = {
                        navController.navigate("tours") {}
                    }
                ) {
                    Text(
                        text = "Aufträge",
                        fontSize = 24.sp,
                        textAlign = TextAlign.Center
                    )
                }
            }
        }
    }
}
