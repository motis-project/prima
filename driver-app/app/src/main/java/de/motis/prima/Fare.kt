package de.motis.prima

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.wrapContentHeight
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.constraintlayout.compose.ConstraintLayout
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavController
import de.motis.prima.viewmodel.FareViewModel
import kotlinx.coroutines.launch

@Composable
fun Fare(
    navController: NavController,
    tourId: Int,
    viewModel: FareViewModel = hiltViewModel(),
) {
    var entryCorrect by remember { mutableStateOf(false) }
    var fare by remember { mutableStateOf("") }
    val snackbarHostState = remember { SnackbarHostState() }
    val networkErrorMessage = stringResource(id = R.string.network_error)
    val inputErrorMessage = stringResource(id = R.string.fare_input_error)

    LaunchedEffect(key1 = viewModel) {
        launch {
            viewModel.reportSuccessEvent.collect {
                navController.navigate("tours") {
                    launchSingleTop = true
                }
            }
        }

        launch {
            viewModel.networkErrorEvent.collect {
                snackbarHostState.showSnackbar(message = networkErrorMessage)
            }
        }

        launch {
            viewModel.conversionErrorEvent.collect {
                snackbarHostState.showSnackbar(message = inputErrorMessage)
            }
        }
    }

    Scaffold(
        topBar = {
            TopBar(
                "tours",
                stringResource(id = R.string.fare_header),
                true,
                listOf(
                    NavItem(
                        text = stringResource(id = R.string.cancel_tour),
                        action = { navController.navigate("tours") }
                    )
                ),
                navController
            )
        },
        snackbarHost = {
            BoxWithConstraints(modifier = Modifier.fillMaxSize()) {
                SnackbarHost(
                    hostState = snackbarHostState,
                    modifier = Modifier
                        .fillMaxSize()
                        .wrapContentHeight(Alignment.Top)
                        .padding(top = maxHeight * 0.25f)
                )
            }
        }
    ) { contentPadding ->
        ConstraintLayout(
            modifier = Modifier
                .fillMaxSize()
                .padding(contentPadding)
        ) {
            Column(
                modifier = Modifier.fillMaxSize(),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Spacer(modifier = Modifier.height(20.dp))
                OutlinedTextField(
                    value = fare,
                    onValueChange = {
                        fare = it
                        entryCorrect = false
                    },
                    label = { Text(stringResource(id = R.string.fare_label)) },
                    maxLines = 1,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    isError = entryCorrect
                )
                Spacer(modifier = Modifier.height(40.dp))
                Button(
                    onClick = {
                        entryCorrect = false
                        viewModel.reportFare(tourId, fare)
                    }
                ) {
                    Text(
                        text = stringResource(id = R.string.send_fare_button_text), fontSize = 20.sp
                    )
                }
                Spacer(modifier = Modifier.height(100.dp))
                val validTickets by viewModel.validTickets.collectAsState()
                val failedReports = validTickets.entries.filter { e -> !e.value.isReported }

                Text(
                    "Fehlgeschlagene Ticket-Validierungen",
                    fontSize = 24.sp,
                    fontWeight = FontWeight.Bold
                )
                Box {
                    LazyColumn(
                        modifier = Modifier
                            .padding(contentPadding)
                    ) {
                        items(items = failedReports, itemContent = { ticket ->
                            Box(
                                modifier = Modifier.fillMaxSize(),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    ticket.value.requestId.toString(),
                                    fontSize = 12.sp
                                )
                            }
                        })
                    }
                }
            }
        }
    }
}
