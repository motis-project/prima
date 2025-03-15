package de.motis.prima

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
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
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.constraintlayout.compose.ConstraintLayout
import androidx.core.text.isDigitsOnly
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavController
import de.motis.prima.data.ValidationStatus
import de.motis.prima.viewmodel.FareViewModel
import kotlinx.coroutines.launch

@Composable
fun Fare(
    navController: NavController,
    tourId: Int,
    viewModel: FareViewModel = hiltViewModel(),
) {
    var fare by remember { mutableStateOf("0,00") }
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
                var fareEuro by remember { mutableStateOf("") }
                var fareCent by remember { mutableStateOf("") }

                Spacer(modifier = Modifier.height(40.dp))
                Text(
                    text = fare,
                    fontSize = 52.sp,
                    fontWeight = FontWeight.Bold
                )
                Spacer(modifier = Modifier.height(40.dp))

                Row(
                    modifier = Modifier
                        .width(300.dp)
                        .padding(20.dp)
                ) {
                    val focusManager = LocalFocusManager.current
                    OutlinedTextField(
                        value = fareEuro,
                        onValueChange = {
                            if (it.contains(',') || it.contains('.'))
                                focusManager.moveFocus(FocusDirection.Next)
                            if (it.isDigitsOnly()) fareEuro = it

                            val displayEuro = fareEuro.ifEmpty { "0" }
                            val displayCent =
                                if (fareCent.isEmpty()) "00"
                                else if (fareCent.length == 1) "0$fareCent" else fareCent

                            fare = "$displayEuro,$displayCent"
                        },
                        label = { Text("Euro") },
                        maxLines = 1,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                        modifier = Modifier.width(120.dp),
                        singleLine = true
                    )

                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = ",", fontSize = 52.sp
                    )
                    Spacer(modifier = Modifier.width(8.dp))

                    OutlinedTextField(
                        value = fareCent,
                        onValueChange = {
                            if (it.length <= 2 && it.isDigitsOnly()) fareCent = it

                            val displayEuro = fareEuro.ifEmpty { "0" }
                            val displayCent =
                                if (fareCent.isEmpty()) "00"
                                else if (fareCent.length == 1) "0$fareCent" else fareCent

                            fare = "$displayEuro,$displayCent"
                        },
                        label = { Text("Cent") },
                        maxLines = 1,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                        modifier = Modifier.width(120.dp),
                        singleLine = true
                    )
                }
                Spacer(modifier = Modifier.height(40.dp))
                Button(
                    onClick = {
                        viewModel.reportFare(tourId, fare)
                    }
                ) {
                    Text(
                        text = stringResource(id = R.string.send_fare_button_text), fontSize = 20.sp
                    )
                }
                Spacer(modifier = Modifier.height(100.dp))
                val scannedTickets by viewModel.scannedTickets.collectAsState()
                val failedReports = scannedTickets.entries
                    .filter { e -> e.value.validationStatus == ValidationStatus.FAILED }

                if (failedReports.isNotEmpty()) {
                    Text(
                        "Fehlgeschlagene Ticket-Validierungen",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(Modifier.height(20.dp))
                    Box {
                        LazyColumn {
                            items(items = failedReports, itemContent = { ticket ->
                                Box(
                                    modifier = Modifier.fillMaxSize(),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text(
                                        ticket.value.requestId.toString(),
                                        fontSize = 16.sp
                                    )
                                }
                            })
                        }
                    }
                }
            }
        }
    }
}
