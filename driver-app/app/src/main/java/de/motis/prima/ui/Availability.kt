package de.motis.prima.ui

import PreviewDayTimeline
import TimeBlock
import android.util.Log
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
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
import de.motis.prima.R
import de.motis.prima.data.DataRepository
import de.motis.prima.ui.theme.LocalExtendedColors
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.time.Duration
import java.time.LocalDate
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import javax.inject.Inject

@HiltViewModel
class AvailabilityViewModel @Inject constructor(
    private val repository: DataRepository
) : ViewModel() {
    private val _displayDate = MutableStateFlow(LocalDate.now())
    val displayDate = _displayDate.asStateFlow()

    val availability = repository.availability

    var currentHour = 0

    init {
        currentHour = hoursSinceStartOfDay(displayDate.value) + 1
        getAvailability(_displayDate.value)
    }

    private fun getAvailability(date: LocalDate) {
        repository.getAvailability(date)
    }

    fun setAvailability(start: Int, end: Int) {
        // {vehicleId: 1, from: 1760104800000, to: 1760106600000}

    }

    private fun hoursSinceStartOfDay(date: LocalDate): Int {
        val startOfDay = date.atStartOfDay(ZoneId.systemDefault())
        val now = ZonedDateTime.now(ZoneId.systemDefault())

        val displayFuture = LocalDate.now().atStartOfDay() < date.atStartOfDay()
        if (displayFuture) {
            return 0
        }

        return Duration.between(startOfDay, now).toHours().toInt()
    }

    fun incrementDate() {
        _displayDate.value = _displayDate.value.plusDays(1)
        repository.getAvailability(_displayDate.value)
    }

    fun decrementDate() {
        val nextDate = _displayDate.value.minusDays(1)
        if (nextDate >= LocalDate.now()) {
            _displayDate.value = nextDate
            repository.getAvailability(_displayDate.value)
        }
    }

    fun setBlocks(newBlocks: List<TimeBlock>) {
        repository.updateAvailability(newBlocks)
    }
}

@Composable
fun DateSelect(
    viewModel: AvailabilityViewModel
) {
    val displayDate by viewModel.displayDate.collectAsState()

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 12.dp)
            .height(100.dp),
        horizontalArrangement = Arrangement.Center
    ) {
        Box(
            modifier = Modifier
                .padding(all = 6.dp),
        ) {
            IconButton(
                onClick = { viewModel.decrementDate() },
                Modifier
                    .size(width = 48.dp, height = 24.dp)
            ) {
                Icon(
                    imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                    contentDescription = "Localized description",
                    modifier = Modifier
                        .size(width = 48.dp, height = 24.dp)
                        .background(LocalExtendedColors.current.secondaryButton)
                        .border(
                            border = BorderStroke(2.dp, LocalExtendedColors.current.secondaryButton),
                            shape = RoundedCornerShape(6.dp)
                        ),
                    tint = LocalExtendedColors.current.textColor
                )
            }
        }
        Box(
            modifier = Modifier
                .padding(all = 6.dp),
        ) {
            Text(
                text = displayDate.format(DateTimeFormatter.ofPattern("dd.MM.yyyy")),
                fontSize = 24.sp,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center
            )
        }
        Box(
            modifier = Modifier
                .padding(all = 6.dp),

            ) {
            IconButton(
                onClick = { viewModel.incrementDate() },
                Modifier
                    .size(width = 48.dp, height = 24.dp)
            ) {
                Icon(
                    imageVector = Icons.AutoMirrored.Filled.ArrowForward,
                    contentDescription = "Localized description",
                    modifier = Modifier
                        .size(width = 48.dp, height = 24.dp)
                        .background(LocalExtendedColors.current.secondaryButton)
                        .border(
                            border = BorderStroke(2.dp, LocalExtendedColors.current.secondaryButton),
                            shape = RoundedCornerShape(6.dp)
                        ),
                    tint = LocalExtendedColors.current.textColor
                )
            }
        }
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
            DateSelect(viewModel)
            PreviewDayTimeline(viewModel)
        }
    }
}
