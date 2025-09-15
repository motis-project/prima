package de.motis.prima.ui

import android.annotation.SuppressLint
import android.util.Log
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardColors
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
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
import de.motis.prima.R
import de.motis.prima.data.DataRepository
import de.motis.prima.data.EventObjectGroup
import de.motis.prima.data.TourObject
import de.motis.prima.data.TourSpecialInfo
import de.motis.prima.ui.theme.LocalExtendedColors
import java.util.Date
import javax.inject.Inject

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

    @SuppressLint("DefaultLocale")
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

    fun isCancelled(tourId: Int): Boolean {
        return repository.isTourCancelled(tourId)
    }

    fun getDateString(): String {
        var dateStrng = ""
        _tour?.let { tour ->
            dateStrng = Date(tour.startTime).formatTo("dd.MM.yyyy")
        }
        return dateStrng
    }

    fun updateEventGroups(tourId: Int) {
        repository.updateEventGroups(tourId)
    }

    fun getTourSpecialInfo(tourId: Int): TourSpecialInfo {
        return repository.getTourSpecialInfo(tourId)
    }
}

@Composable
fun TourPreview(
    navController: NavController,
    tourId: Int,
    viewModel: TourViewModel = hiltViewModel()
) {
    val isCancelled = viewModel.isCancelled(tourId)

    LaunchedEffect(Unit) {
        viewModel.updateEventGroups(tourId)
    }

    Scaffold(
        topBar = {
            TopBar(
                stringResource(id = R.string.tour_preview_header),
                true,
                emptyList(),
                navController
            )
        }
    ) { contentPadding ->
        BoxWithConstraints(
            modifier = Modifier.fillMaxSize()
        ) {
            val parentHeight = maxHeight
            Column(
                modifier = Modifier
                    .padding(contentPadding)
                    .fillMaxSize(),
                verticalArrangement = Arrangement.SpaceBetween
            ) {
                Box(
                    modifier = Modifier
                        .height(parentHeight * 1f)
                        .fillMaxWidth()
                ) {
                    if (isCancelled) {
                        Box(
                            modifier = Modifier
                                .height(parentHeight * 0.1f)
                                .fillMaxWidth(),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = "Fahrt storniert",
                                fontSize = 24.sp,
                                textAlign = TextAlign.Center,
                                color = Color.Red
                            )
                        }
                    } else if (viewModel.isInPAst(tourId)) {
                        RetroView(viewModel, tourId, navController)
                    } else {
                        WayPointsView(viewModel, tourId, navController)
                    }
                }
            }
        }
    }
}

@Composable
fun TourInfoView(tourInfo: TourSpecialInfo) {
    Card(
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier
            .padding(10.dp),
        colors = CardColors(LocalExtendedColors.current.containerColor, Color.Black, Color.White, Color.White)
    ) {
        Row(
            modifier = Modifier
                .fillMaxSize(),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment =  Alignment.CenterVertically
        ) {
            if (tourInfo.wheelChairs != 0) {
                Text(
                    text = "${tourInfo.wheelChairs}",
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold
                )
                Text(text = " x ")
                Icon(
                    painter = painterResource(id = R.drawable.ic_wheelchair),
                    contentDescription = "Localized description",
                    Modifier.fillMaxHeight()
                )
            }
            if (tourInfo.kidsZeroToTwo != 0) {
                Spacer(Modifier.width(10.dp))
                Text(
                    text = "${tourInfo.kidsZeroToTwo}",
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold
                )
                Text(text = " x ")
                Icon(
                    painter = painterResource(id = R.drawable.ic_child_seat),
                    contentDescription = "Localized description",
                    Modifier.fillMaxHeight()
                )
                Text(text = "0-2J")
            }
            if (tourInfo.kidsThreeToFour != 0) {
                Spacer(Modifier.width(10.dp))
                Text(
                    text = "${tourInfo.kidsThreeToFour}",
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold
                )
                Text(text = " x ")
                Icon(
                    painter = painterResource(id = R.drawable.ic_child_seat),
                    contentDescription = "Localized description",
                    Modifier.fillMaxHeight()
                )
                Text(text = "3-4J")
            }
            if (tourInfo.kidsFiveToSix != 0) {
                Spacer(Modifier.width(10.dp))
                Text(
                    text = "${tourInfo.kidsFiveToSix}",
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold
                )
                Text(text = " x ")
                Icon(
                    painter = painterResource(id = R.drawable.ic_child_seat),
                    contentDescription = "Localized description",
                    Modifier.fillMaxHeight()
                )
                Text(text = "5-6J")
            }
        }
    }
}

@Composable
fun WayPointsView(viewModel: TourViewModel, tourId: Int, navController: NavController) {
    BoxWithConstraints(
        modifier = Modifier.fillMaxSize()
    ) {
        val parentHeight = maxHeight

        Column {
            Box(
                modifier = Modifier.fillMaxWidth().height(parentHeight * 0.1f),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = viewModel.getDateString(),
                    fontSize = 24.sp,
                    textAlign = TextAlign.Center,
                    fontWeight = FontWeight.Bold
                )
            }

            Box(
                modifier = Modifier.fillMaxWidth().height(parentHeight * 0.6f)
            ) {
                val eventGroups = viewModel.eventObjectGroups.collectAsState()
                val listState = rememberLazyListState()
                val isAtEnd by remember {
                    derivedStateOf {
                        val lastVisibleItem = listState.layoutInfo.visibleItemsInfo.lastOrNull()
                        val totalItems = listState.layoutInfo.totalItemsCount
                        lastVisibleItem != null && lastVisibleItem.index == totalItems - 1
                    }
                }
                Card(
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier
                        .padding(10.dp)
                ) {
                    Column {
                        LazyColumn(state = listState,
                            modifier = Modifier
                                .background(LocalExtendedColors.current.containerColor)
                                .weight(0.9f)
                        ) {
                            items(items = eventGroups.value, itemContent = { eventGroup ->
                                WayPointPreview(eventGroup)
                            })

                        }
                        Box(
                            modifier = Modifier
                                .background(LocalExtendedColors.current.containerColor)
                                .fillMaxWidth()
                                .weight(0.1f),
                            contentAlignment = Alignment.Center
                        ) {
                            if (isAtEnd.not()) {
                                Box(
                                    modifier = Modifier.size(36.dp)
                                ) {
                                    Icon(
                                        painter = painterResource(id = R.drawable.ic_dropdown),
                                        contentDescription = "Localized description"
                                    )
                                }
                            }
                        }
                    }
                }
            }

            Box(
                modifier = Modifier.fillMaxWidth().height(parentHeight * 0.1f)
            ) {
                val tourInfo = viewModel.getTourSpecialInfo(tourId)
                if (tourInfo.hasInfo) {
                    TourInfoView(tourInfo)
                }
            }

            Box(
                modifier = Modifier.fillMaxWidth().height(parentHeight * 0.2f),
                contentAlignment = Alignment.Center
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
}

@Composable
fun RetroView(viewModel: TourViewModel, tourId: Int, navController: NavController) {
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
                    text = "Die Fahrt enthält mindestens ein unvalidiertes Ticket.",
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

    try {
        scheduledTime = Date(eventGroup.arrivalTime).formatTo("HH:mm")
    } catch (e: Exception) {
        Log.d("error", "Failed to read event details")
        return
    }

    val cancelled = eventGroup.events.find { e -> e.cancelled.not() } == null
    if (cancelled.not()) {
        Card(
            modifier = Modifier
                .padding(10.dp),
            colors = CardDefaults.cardColors(containerColor = LocalExtendedColors.current.containerColor)
        ) {
            Column(
                verticalArrangement = Arrangement.Center
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(top = 6.dp),
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
                        .padding(top = 12.dp, bottom = 6.dp),
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
}
