package de.motis.prima.ui

import PreviewDayTimeline
import TimeBlock
import android.util.Log
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.navigation.NavController
import dagger.hilt.android.lifecycle.HiltViewModel
import de.motis.prima.R
import de.motis.prima.data.DataRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject

@HiltViewModel
class AvailabilityViewModel @Inject constructor(
    private val repository: DataRepository
) : ViewModel() {
    private val _blocks = MutableStateFlow<List<TimeBlock>>(emptyList())
    val blocks = _blocks.asStateFlow()

    val availability = repository.availability

    init {
        Log.d("test", "init time blocks")
        // TODO: get time slots from backend and init blocks
        getAvailability()
    }

    fun getAvailability() {
        repository.getAvailability()
        Log.d("test", "AvailabilityViewModel: ${availability.value}")
    }

    fun setAvailability(start: Int, end: Int) {
        // {vehicleId: 1, from: 1760104800000, to: 1760106600000}

    }
}

@Composable
fun Availability(
    navController: NavController,
    viewModel: AvailabilityViewModel = hiltViewModel()
) {
    Scaffold(
        topBar = {
            TopBar(
                stringResource(id = R.string.availability),
                true,
                listOf(
                    NavItem(
                        text = stringResource(id = R.string.change_vehicles),
                        action = { navController.navigate("vehicles") }
                    )
                ),
                navController
            )
        }
    ) { contentPadding ->
        Box(modifier = Modifier.padding(contentPadding)) {
            PreviewDayTimeline(viewModel)
        }
    }
}
