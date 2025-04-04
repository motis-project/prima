package de.motis.prima

import android.util.Log
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardColors
import androidx.compose.material3.Icon
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.navigation.NavController
import dagger.hilt.android.lifecycle.HiltViewModel
import de.motis.prima.data.DataRepository
import de.motis.prima.data.EventObjectGroup
import de.motis.prima.data.TourObject
import java.util.Date
import javax.inject.Inject

@HiltViewModel
class TourViewModel @Inject constructor(
    val repository: DataRepository
) : ViewModel() {
    val eventObjectGroups = repository.eventObjectGroups
    val pendingValidationTickets = repository.pendingValidationTickets

    private var _tour: TourObject? = null

    init {
        repository.cancelNotifications()
    }

    fun isInPAst(tourId: Int): Boolean {
        _tour = repository.getTour(tourId)
        if (_tour != null) {
            val now = Date()
            val endTime = Date(_tour!!.endTime)
            return endTime < now
        }
        return false
    }

    fun getFareString(): String {
        var res = ""
        if (_tour != null) {
            val fare = ((_tour!!.fare) * 1.0 / 100)
            val rounded = String.format("%.2f", fare).replace('.', ',')
            res = "$rounded Euro"
        }
        return res
    }

    fun hasPendingValidations(tourId: Int): Boolean {
        return repository.hasPendingValidations(tourId)
    }

    fun hasInvalidatedTickets(tourId: Int): Boolean {
        return repository.hasInvalidatedTickets(tourId)
    }
}

@Composable
fun TourPreview(
    navController: NavController,
    tourId: Int,
    viewModel: TourViewModel = hiltViewModel()
) {
    Scaffold(
        topBar = {
            TopBar(
                "tours",
                stringResource(id = R.string.tour_preview_header),
                true,
                emptyList(),
                navController
            )
        }
    ) { contentPadding ->
        Column(
            modifier = Modifier
                .padding(contentPadding)
        ) {
            if (viewModel.isInPAst(tourId)) {
                RetroView(viewModel, navController, tourId)
            } else {
                WayPointsView(viewModel, navController, tourId)
            }
        }
    }
}

@Composable
fun WayPointsView(viewModel: TourViewModel, navController: NavController, tourId: Int) {
    Column {
        Row(
            modifier = Modifier.fillMaxWidth().weight(1f),
        ) {
            Card(
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier
                    .padding(10.dp)
            ) {
                val eventGroups = viewModel.eventObjectGroups.collectAsState()
                LazyColumn(
                    modifier = Modifier
                        .background(Color.White)
                        .fillMaxSize(),
                ) {
                    var index = 0
                    val maxIndex = eventGroups.value.size - 1
                    items(items = eventGroups.value, itemContent = { eventGroup ->
                        WayPointPreview(eventGroup)

                        if (index < maxIndex) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth(),
                                horizontalArrangement = Arrangement.Center
                            ) {
                                Box(
                                    modifier = Modifier.size(48.dp)
                                ) {
                                    Icon(
                                        painter = painterResource(id = R.drawable.ic_dropdown),
                                        contentDescription = "Localized description"
                                    )
                                }
                            }
                        }

                        index++
                    })
                }
            }
        }

        Row(
            modifier = Modifier.fillMaxWidth().height(120.dp),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Button(
                onClick = {
                    navController.navigate("leg/$tourId/0")
                }
            ) {
                Text(
                    text = "Fahrt starten",
                    fontSize = 24.sp,
                    textAlign = TextAlign.Center
                )
            }
        }
    }
}

@Composable
fun RetroView(viewModel: TourViewModel, navController: NavController, tourId: Int) {
    val pendingValidationTickets by viewModel.pendingValidationTickets.collectAsState()

    Column(
        modifier = Modifier.fillMaxSize().padding(30.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "Fahrpreis:",
                fontSize = 24.sp,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = viewModel.getFareString(),
                fontSize = 24.sp
            )
        }

        if (viewModel.hasPendingValidations(tourId).not()
            && viewModel.hasInvalidatedTickets(tourId)) {

            Row(
                modifier = Modifier.fillMaxWidth().padding(top = 20.dp),
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Die Fahrt enthält kein validiertes Ticket.",
                    fontSize = 24.sp,
                    color = Color.Red
                )
            }
        } else {
            Row(
                modifier = Modifier.fillMaxWidth().padding(top = 10.dp),
                horizontalArrangement = Arrangement.End,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Button(
                    onClick = {
                        navController.navigate("fare/$tourId")
                    }
                ) {
                    Text(
                        text = "Ändern",
                        textAlign = TextAlign.Center
                    )
                }
            }
        }

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            for (ticket in pendingValidationTickets) {
                Text(
                    text = "${ticket.requestId}, ${ticket.validationStatus}",
                    fontSize = 12.sp,
                    textAlign = TextAlign.Center
                )
            }
        }
    }
}

@Composable
fun WayPointPreview(
    eventGroup: EventObjectGroup
) {
    val scheduledTime: String

    try { //TODO
        scheduledTime = Date(eventGroup.arrivalTime).formatTo("HH:mm")
    } catch (e: Exception) {
        Log.d("error", "Failed to read event details")
        return
    }

    Card(
        modifier = Modifier
            .padding(10.dp),
        colors = CardColors(Color.White, Color.Black, Color.White, Color.White)
    ) {
        Column(
            verticalArrangement = Arrangement.Center
        ) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(top = 12.dp),
                horizontalArrangement = Arrangement.Center
            ) {
                Text(
                    text = scheduledTime,
                    fontWeight = FontWeight.Bold,
                    fontSize = 24.sp,
                    textAlign = TextAlign.Center
                )
            }
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 12.dp, bottom = 12.dp),
                horizontalArrangement = Arrangement.Center
            ) {
                Text(
                    text = eventGroup.address,
                    fontSize = 24.sp,
                    textAlign = TextAlign.Center
                )
            }
        }
    }
}
