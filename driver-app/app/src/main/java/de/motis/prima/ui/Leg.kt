package de.motis.prima.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.navigation.NavController
import dagger.hilt.android.lifecycle.HiltViewModel
import de.motis.prima.data.DataRepository
import javax.inject.Inject

@HiltViewModel
class LegViewModel @Inject constructor(
    private val repository: DataRepository
) : ViewModel() {
    val eventGroups = repository.eventObjectGroups

    init {
        repository.fetchTours()
    }

    fun update(tourId: Int) {
        repository.updateEventGroups(tourId)
    }
}

@Composable
fun Leg(
    navController: NavController,
    tourId: Int,
    eventGroupIndex: Int,
    viewModel: LegViewModel = hiltViewModel()
) {
    val eventGroups = viewModel.eventGroups.collectAsState().value

    Scaffold(
        topBar = {
            TopBar(
                "Fahrt",
                true,
                emptyList(),
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
                    viewModel.update(tourId)
                    val nav = if (eventGroupIndex < eventGroups.size - 1) {
                        "leg/$tourId/${eventGroupIndex + 1}"
                    } else {
                        "fare/$tourId"
                    }

                    BoxWithConstraints {
                        val screenWidth = maxWidth

                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.Center
                        ) {
                            Box(
                                modifier = Modifier
                                    .width(screenWidth * 0.98f)
                            ) {
                                EventGroup(
                                    navController,
                                    eventGroups[eventGroupIndex],
                                    nav
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}
