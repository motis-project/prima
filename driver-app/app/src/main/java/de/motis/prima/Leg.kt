package de.motis.prima

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController
import dagger.hilt.android.lifecycle.HiltViewModel
import de.motis.prima.data.DataRepository
import javax.inject.Inject

@HiltViewModel
class LegViewModel @Inject constructor(
    private val repository: DataRepository
) : ViewModel() {
    val eventGroups = repository.eventObjectGroups

    fun isTourStarted(tourId: Int): Boolean {
        return repository.isTourStarted(tourId)
    }
}

@Composable
fun Leg(
    navController: NavController,
    tourId: Int,
    eventGroupIndex: Int,
    legViewModel: LegViewModel = hiltViewModel()
) {
    val eventGroups = legViewModel.eventGroups.collectAsState().value

    Scaffold(
        topBar = {
            TopBar(
                if (eventGroupIndex != 0) "leg/$tourId/${eventGroupIndex - 1}" else "preview/$tourId",
                "Fahrt",
                true,
                listOf(
                    NavItem(
                        text = stringResource(id = R.string.cancel_tour),
                        action = { navController.navigate("tours") }
                    )
                ),
                navController
            )
        }
    ) { contentPadding ->
        Column(
            Modifier
                .fillMaxSize()
                .padding(contentPadding)
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(12.dp),
                horizontalArrangement = Arrangement.Center
            ) {
                if (eventGroups.isNotEmpty()) {
                    var nav = "leg/$tourId/${eventGroupIndex + 1}"
                    if (eventGroupIndex + 1 == eventGroups.size) {
                        if (legViewModel.isTourStarted(tourId)) {
                            nav = "fare/$tourId"
                        } else {
                            nav = "tours"
                        }
                    }

                    BoxWithConstraints {
                        val screenWidth = maxWidth
                        val screenHeight = maxHeight

                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.Center
                        ) {
                            val height = screenHeight * 0.95f
                            Box(
                                modifier = Modifier
                                    //.height(height)
                                    //.width(screenWidth * 0.98f)
                            ) {
                                EventGroup(
                                    navController,
                                    eventGroups[eventGroupIndex],
                                    nav,
                                    tourId
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}
