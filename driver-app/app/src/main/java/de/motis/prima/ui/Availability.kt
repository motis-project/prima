package de.motis.prima.ui

import DayTimeline
import android.app.DatePickerDialog
import android.util.Log
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.navigation.NavController
import dagger.hilt.android.lifecycle.HiltViewModel
import de.motis.prima.R
import de.motis.prima.data.DataRepository
import de.motis.prima.services.ApiService
import de.motis.prima.services.AvailabilityRequest
import de.motis.prima.services.AvailabilityResponse
import de.motis.prima.ui.theme.LocalExtendedColors
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOn
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import retrofit2.Response
import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.ZonedDateTime
import java.util.Calendar
import javax.inject.Inject

data class TimeBlock(
    val date: LocalDate,
    val startMinutes: Int, // minutes since start of day
    val endMinutes: Int,
    var color: Color = Color.White,
    var modified: Boolean = false
)

@HiltViewModel
class AvailabilityViewModel @Inject constructor(
    private val repository: DataRepository,
    private val apiService: ApiService,
) : ViewModel() {
    private val _displayDate = MutableStateFlow(LocalDate.now())
    val displayDate = _displayDate.asStateFlow()
    private val shiftStart = 3
    val shiftEnd = 24
    private val slotMinutes = 15

    private val _passedSlots = MutableStateFlow(0)
    val passedSlots = _passedSlots.asStateFlow()

    private val _passedHours = MutableStateFlow(0)
    val passedHours = _passedHours.asStateFlow()

    private val _dayBlocks = MutableStateFlow<List<TimeBlock>>(emptyList())
    val dayBlocks = _dayBlocks.asStateFlow()

    private val dayMap = mutableMapOf<String, List<TimeBlock>>()

    private val _networkError = MutableStateFlow(false)
    val networkError = _networkError.asStateFlow()

    private val colorAvailable = Color(254, 249, 195)
    private val colorTour = Color(251 ,146, 60)
    private val colorPassed = Color.LightGray
    private val colorUnmodified = Color.White

    val selectedVehicle = repository.selectedVehicle
        .stateIn(viewModelScope, SharingStarted.Eagerly, null)

    val calendar: Calendar = repository.calendar
    private val _maxDateReached = MutableStateFlow(false)
    val maxDateReached = _maxDateReached.asStateFlow()

    private val _minDateReached = MutableStateFlow(false)
    val minDateReached = _minDateReached.asStateFlow()

    init {
        setDayBlocks(_displayDate.value, _displayDate.value)
        setPassedSlots(_displayDate.value)

        _minDateReached.value = _displayDate.value <= LocalDate.now()
        _maxDateReached.value = _displayDate.value >= LocalDate.now().plusDays(14)
    }

    private fun getSlotIndex(startMinutes: Int): Int {
        if (startMinutes == 0) {
            return 0
        }
        return (startMinutes / 15)
    }

    private fun minutesSinceStartOfDay(epochMillis: Long, zoneId: ZoneId = ZoneId.systemDefault()): Long {
        val time = Instant.ofEpochMilli(epochMillis).atZone(zoneId)
        val startOfDay = time.toLocalDate().atStartOfDay(zoneId)
        val duration = Duration.between(startOfDay, time)
        return duration.toMinutes()
    }

    private fun minutesSinceStartOfDay(date: LocalDate): Int {
        val startOfDay = date.atStartOfDay(ZoneId.systemDefault())
        val now = ZonedDateTime.now(ZoneId.systemDefault())

        val displayFuture = LocalDate.now().atStartOfDay() < date.atStartOfDay()
        if (displayFuture) {
            return 0
        }

        return Duration.between(startOfDay, now).toMinutes().toInt()
    }

    private fun roundDownToQuarterHour(minutes: Int): Int {
        return (minutes / 15) * 15
    }

    private fun roundUpToQuarterHour(minutes: Int): Int {
        return (minutes / 15) * 15 + 15
    }

    private suspend fun getTimeBlocks(availability: AvailabilityResponse): MutableList<TimeBlock> {
        val blocks: MutableList<TimeBlock> = emptyList<TimeBlock>().toMutableList()
        for (vehicle in availability.vehicles) {
            if (vehicle.id != repository.selectedVehicle.first().id) {
                continue
            }
            for (av in vehicle.availability) {
                val startTime = minutesSinceStartOfDay(av.startTime).toInt()
                var endTime = minutesSinceStartOfDay(av.endTime).toInt()
                if (endTime == 0) endTime = 1439 // 23:59
                var a = startTime
                while (a < endTime) {
                    val b = a + 15
                    val date = repository.localDateFromEpochMillis(av.startTime)
                    val timeBlock = TimeBlock(date, a, b, colorAvailable, false)
                    blocks += timeBlock
                    a = b
                }
            }
        }
        for (tour in availability.tours) {
            if (tour.vehicleId != repository.selectedVehicle.first().id) {
                continue
            }
            val startTime = roundDownToQuarterHour(minutesSinceStartOfDay(tour.startTime).toInt())
            val endTime = roundUpToQuarterHour(minutesSinceStartOfDay(tour.endTime).toInt())
            var a = startTime
            while (a < endTime) {
                val b = a + 15
                val date = repository.localDateFromEpochMillis(tour.startTime)
                val timeBlock = TimeBlock(date, a, b, colorTour, false)
                blocks += timeBlock
                a = b
            }
        }
        return blocks
    }

    private fun mergeModifications(date: LocalDate): List<List<TimeBlock>> {
        val blocks = dayMap[date.toString()] ?: return emptyList()
        val intervals = mutableListOf<List<TimeBlock>>()
        var i = 0
        while (i < blocks.size) {
            val current = blocks[i]
            if (current.modified.not()) {
                i++
                continue
            }
            val interval = mutableListOf(current)
            var j = i + 1
            while (j < blocks.size && blocks[j].modified && blocks[j].color == current.color) {
                interval += blocks[j]
                j++
            }
            intervals += interval
            i = j
        }
        return intervals
    }

    private fun refresh(): Flow<Response<AvailabilityResponse>> = flow {
        val today = LocalDate.now()
        val offsetMinutes = repository.utcOffset / 60
        val request = AvailabilityRequest(
            repository.selectedVehicle.first().id,
            from = emptyList(),
            to = emptyList(),
            add = emptyList(),
            offset = offsetMinutes * -1,
            date = today.toString()
        )
        while (true) {
            if (today == displayDate.value) {
                try {
                    emit(apiService.getAvailability(request))
                } catch (e: Exception) {
                    _networkError.value = true
                }
                delay(10000) // 10 sec
            }
        }
    }.flowOn(Dispatchers.IO)

    private fun findInterval(minute: Int, intervals: List<List<TimeBlock>>): List<TimeBlock>? {
        return try {
            intervals.first { i -> i.first().startMinutes <= minute && i.last().endMinutes >= minute }
        } catch (e: NoSuchElementException) {
            null
        }
    }

    private fun setDayBlocks(saveDate: LocalDate, fetchDate: LocalDate) {
        val totalMinutes = 24 * 60
        val slotMinutes = 15
        val offsetMinutes = repository.utcOffset / 60
        val epochMillisSTOD = saveDate.atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()

        var i = 0
        val tmpDayBlocks = mutableListOf<TimeBlock>()
        while (i < totalMinutes) {
            val next = i + slotMinutes
            val color = if (fetchDate == LocalDate.now() && i <= minutesSinceStartOfDay(fetchDate) + 60) colorPassed else colorUnmodified
            tmpDayBlocks += TimeBlock(fetchDate, i, next, color, false)
            i = next
        }

        val intervals = mergeModifications(fetchDate)
        Log.d("merge", "merged: $intervals") //TODO: fix merging
        val from = mutableListOf<Long>()
        val to = mutableListOf<Long>()
        val add = mutableListOf<Boolean>()
        for (interval in intervals) {
            val firstStart = interval.first().startMinutes
            val lastEnd = interval.last().endMinutes
            from += epochMillisSTOD + firstStart * 60000
            to += epochMillisSTOD + lastEnd * 60000
            add += interval.first().color == colorAvailable
        }

        CoroutineScope(Dispatchers.IO).launch {
            val request = AvailabilityRequest(
                repository.selectedVehicle.first().id,
                from,
                to,
                add,
                offset = offsetMinutes,
                date = fetchDate.toString()
            )

            try {
                val response = apiService.getAvailability(request)
                if (response.isSuccessful) {
                    _networkError.value = false
                    val resBody = response.body() ?: AvailabilityResponse()
                    val timeBlocks = getTimeBlocks(resBody)
                    val update = dayMap.containsKey(fetchDate.toString())

                    timeBlocks.forEach { block ->
                        var wasSent = false
                        var unmodified = true
                        val index = getSlotIndex(block.startMinutes)
                        val alterable = tmpDayBlocks[index].color != colorPassed

                        if (update) {
                            val oldState = dayMap[fetchDate.toString()]!![index]
                            unmodified = oldState.modified.not()

                            val containingInterval = findInterval(oldState.startMinutes, intervals)
                            containingInterval?.let { interval ->
                                val startContained = resBody.from.contains(epochMillisSTOD + interval.first().startMinutes * 60000)
                                val endContained = resBody.to.contains(epochMillisSTOD + interval.last().endMinutes * 60000)
                                wasSent = startContained && endContained
                            }
                        }

                        if (alterable && (wasSent || unmodified)) {
                            tmpDayBlocks[index].color = block.color
                        }
                    }

                    dayMap[fetchDate.toString()] = tmpDayBlocks
                    _dayBlocks.value = tmpDayBlocks
                }
            } catch (e: Exception) {
                _networkError.value = true
                Log.e("error", "${e.message}")
            }
        }
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

    private fun setPassedSlots(date: LocalDate) {
        val currentHour = hoursSinceStartOfDay(date)
        val passedHours = if ( date == LocalDate.now() ) currentHour + 1 else shiftStart
        _passedHours.value = passedHours
        _passedSlots.value = passedHours * 60 / slotMinutes
    }

    fun incrementDate() {
        if (maxDateReached.value) {
            return
        }

        val saveDate = _displayDate.value
        val fetchDate = _displayDate.value.plusDays(1)
        setPassedSlots(fetchDate)
        setDayBlocks(saveDate, fetchDate)

        _displayDate.value = fetchDate
        _minDateReached.value = fetchDate <= LocalDate.now()
        _maxDateReached.value = fetchDate >= LocalDate.now().plusDays(14)
    }

    fun decrementDate() {
        if (minDateReached.value) {
            return
        }

        val saveDate = _displayDate.value
        val fetchDate = _displayDate.value.minusDays(1)
        setPassedSlots(fetchDate)
        setDayBlocks(saveDate, fetchDate)

        _displayDate.value = fetchDate
        _minDateReached.value = fetchDate <= LocalDate.now()
        _maxDateReached.value = fetchDate >= LocalDate.now().plusDays(14)
    }

    fun setDate(date: LocalDate) {
        val saveDate = _displayDate.value

        if (saveDate < LocalDate.now() || saveDate > LocalDate.now().plusDays(14)) {
            return
        }

        setPassedSlots(date)
        setDayBlocks(saveDate, date)

        _displayDate.value = date
        _minDateReached.value = date <= LocalDate.now()
        _maxDateReached.value = date >= LocalDate.now().plusDays(14)
    }

    fun updateDayBlocks(start: Int, end: Int, dragStart: Int) {
        val blocks = dayMap[_displayDate.value.toString()] ?: emptyList()
        val startBlock = blocks[getSlotIndex(dragStart)]
        val remove = startBlock.color == colorAvailable
        var a = getSlotIndex(start)
        val b = getSlotIndex(end)
        while ( a < b ) {
            if (blocks[a].color == colorPassed || blocks[a].color == colorTour) {
                a++
                continue
            }
            if (remove) {
                blocks[a].color = colorUnmodified
            } else {
                blocks[a].color = colorAvailable
            }
            blocks[a].modified = blocks[a].modified.not()
            a++
        }
        _dayBlocks.value = blocks
        dayMap[_displayDate.value.toString()] = blocks
        setDayBlocks(_displayDate.value, _displayDate.value)
    }
}

@Composable
fun DateSelect(
    viewModel: AvailabilityViewModel
) {
    val displayDate by viewModel.displayDate.collectAsState()
    val minDateReached by viewModel.minDateReached.collectAsState()
    val maxDateReached by viewModel.maxDateReached.collectAsState()

    val context = LocalContext.current
    val datePickerDialog = DatePickerDialog(
        context,
        { _, year, month, dayOfMonth ->
            var monStr = (month + 1).toString()
            var dayStr = dayOfMonth.toString()
            if (monStr.length < 2) {
                monStr = "0$monStr"
            }
            if (dayStr.length < 2) {
                dayStr = "0$dayStr"
            }
            viewModel.setDate(LocalDate.parse("$year-${monStr}-$dayStr"))
        },
        viewModel.calendar.get(Calendar.YEAR),
        viewModel.calendar.get(Calendar.MONTH),
        viewModel.calendar.get(Calendar.DAY_OF_MONTH)
    )
    datePickerDialog.datePicker.minDate = System.currentTimeMillis()
    datePickerDialog.datePicker.maxDate = System.currentTimeMillis() + 1209600000 // 2 weeks
    datePickerDialog.datePicker.firstDayOfWeek = Calendar.MONDAY

    Row(
        modifier = Modifier
            .fillMaxWidth(),
        horizontalArrangement = Arrangement.Center
    ) {
        // decrement date arrow button
        Box(
            modifier = Modifier
                .padding(all = 6.dp)
                .width(50.dp),
        ) {
            if (minDateReached.not()) {
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
        }
        // date picker
        Box(
            modifier = Modifier.padding(all = 6.dp),
        ) {
            Button(
                modifier = Modifier.height(24.dp).width(120.dp),
                contentPadding = PaddingValues(horizontal = 4.dp, vertical = 2.dp),
                onClick = { datePickerDialog.show() }) {
                Text(
                    text= "$displayDate",
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp
                )
            }
        }
        // increment date arrow button
        Box(
            modifier = Modifier
                .padding(all = 6.dp)
                .width(50.dp),
            ) {
            if (maxDateReached.not()) {
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
        // refresh button
        Box(
            modifier = Modifier.padding(all = 6.dp),
        ) {
            IconButton(
                onClick = { viewModel.setDate(displayDate) },
                Modifier
                    .size(width = 48.dp, height = 24.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.Refresh,
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
        Column(modifier = Modifier.padding(contentPadding)) {
            val vehicle by viewModel.selectedVehicle.collectAsState()
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(12.dp),
                contentAlignment = Alignment.Center
            ) {
                vehicle?.let {
                    Text(
                        text = it.licensePlate,
                        fontSize = 16.sp,
                        textAlign = TextAlign.Center
                    )
                }
            }
            DateSelect(viewModel)
            DayTimeline(navController, viewModel)
        }
    }
}
