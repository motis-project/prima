package de.motis.prima

import android.util.Log
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.wrapContentSize
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
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
import de.motis.prima.services.Event
import de.motis.prima.services.Tour
import io.realm.kotlin.internal.realmValueToRealmUUID
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.time.LocalDate
import java.util.Date
import java.util.Formatter
import javax.inject.Inject

data class Location(
    val latitude: Double,
    val longitude: Double,
)

data class EventGroup(//TODO
    val id: String,
    val arrivalTime: Long,
    val location: Location,
    val address: String,
    val events: List<Event>,
    var stopIndex: Int,
    var hasPickup: Boolean
)

@HiltViewModel
class TourViewModel @Inject constructor(
    val repository: DataRepository
) : ViewModel() {
    val eventObjectGroups = repository.eventObjectGroups
    val pendingValidationTickets = repository.pendingValidationTickets

    private var _tour: TourObject? = null

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
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            Spacer(modifier = Modifier.height(42.dp))
            Row(
                horizontalArrangement = Arrangement.Center
            ) {
                if (viewModel.isInPAst(tourId)) {
                    RetroView(viewModel, navController, tourId)
                } else {
                    WayPointsView(viewModel, navController, tourId)
                }
            }
        }
    }
}

@Composable
fun WayPointsView(viewModel: TourViewModel, navController: NavController, tourId: Int) {
    Column {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.Center
        ) {
            val eventGroups = viewModel.eventObjectGroups.collectAsState()
            LazyColumn {
                items(items = eventGroups.value, itemContent = { eventGroup ->
                    WayPointPreview(eventGroup)
                })
            }
        }
        Spacer(modifier = Modifier.height(48.dp))
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.Center
        ) {
            Button(
                modifier = Modifier.width(300.dp),
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
                modifier = Modifier.fillMaxWidth().padding(top = 10.dp),
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Die Fahrt enthält unvalidierte Tickets.",
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

    Column(modifier = Modifier.padding(10.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.Center
        ) {
            Text(
                text = scheduledTime,
                fontWeight = FontWeight.Bold,
                fontSize = 24.sp,
                textAlign = TextAlign.Center
            )
        }
        Spacer(modifier = Modifier.height(4.dp))
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 12.dp),
            horizontalArrangement = Arrangement.Center
        ) {
            Text(
                text = eventGroup.address,
                fontSize = 24.sp,
                textAlign = TextAlign.Center
            )
        }
        Spacer(modifier = Modifier.height(30.dp))
    }
}
