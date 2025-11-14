import android.util.Log
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
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
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import de.motis.prima.R
import de.motis.prima.ui.AvailabilityViewModel
import java.time.LocalDate

@Composable
fun DayTimeline(
    navController: NavController,
    viewModel: AvailabilityViewModel
) {
    val shiftStart = 3
    val shiftEnd = 24
    val trailingMinutes = (24 - shiftEnd) * 60
    val totalMinutes = 24  * 60
    val slotMinutes = 15
    val slots = (totalMinutes - trailingMinutes) / slotMinutes

    var dragStart by remember { mutableStateOf<Int?>(null) }
    var dragEnd by remember { mutableStateOf<Int?>(null) }

    val scrollState = rememberScrollState()
    val dayBlocks by viewModel.dayBlocks.collectAsState()

    val date by viewModel.displayDate.collectAsState()
    val passedHours = if ( date == LocalDate.now() ) viewModel.currentHour else shiftStart
    val passedSlots by viewModel.passedSlots.collectAsState()

    var showDialog by remember { mutableStateOf(false) }

    LaunchedEffect(key1 = viewModel) {
        viewModel.networkError.collect { networkError ->
            showDialog = networkError
        }
    }

    if (showDialog) {
        AlertDialog(
            onDismissRequest = { showDialog = false },
            title = { Text(text = stringResource(id = R.string.availabilityNetErrorTitle), fontSize = 16.sp) },
            text = { Text(text = stringResource(id = R.string.availabilityNetErrorText), fontSize = 12.sp) },
            icon = {
                Icon(
                    imageVector = Icons.Default.Clear,
                    contentDescription = "Localized description",
                    tint = Color.Red,
                    modifier = Modifier.size(32.dp)

                )
            },
            confirmButton = {
                Button(onClick = {
                    showDialog = false
                    navController.popBackStack()
                }) {
                    Text("Ok")
                }
            }
        )
    }

    Row (modifier = Modifier.padding(top = 65.dp)) {
        val heightPerSlotDp = 120.dp / (60 / slotMinutes)
        val totalHeight = heightPerSlotDp * (slots + 1 - passedSlots)

        // time line
        Column(
            modifier = Modifier
                .fillMaxWidth(0.95f)
                .fillMaxHeight()
                .verticalScroll(scrollState)
        ) {
            Row(
                modifier = Modifier
                    .background(Color.White)
            ) {
                // Hour labels
                Column(
                    modifier = Modifier
                        .width(50.dp)
                        .height(totalHeight),
                    horizontalAlignment = Alignment.End
                ) {
                    val heightPerHourDp = heightPerSlotDp * 4
                    for (hour in passedHours..shiftEnd) {
                        Box(
                            modifier = Modifier
                                .height(heightPerHourDp)
                                .fillMaxWidth(),
                            contentAlignment = Alignment.TopEnd
                        ) {
                            Text(
                                text = String.format("%02d:00", hour),
                                fontSize = 10.sp,
                                color = Color.DarkGray
                            )
                        }
                    }
                }

                // Timeline drawing area
                Box(modifier = Modifier.weight(1f)) {
                    val visibleHeight = heightPerSlotDp * slots - heightPerSlotDp * passedSlots
                    val passedSlotsLocal by viewModel.passedSlots.collectAsState()
                    Canvas(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(visibleHeight)
                            .padding(top = 12.dp, start = 6.dp, end = 12.dp)
                            .pointerInput(Unit) {
                                detectTapGestures { offset ->
                                    val slot = (offset.y / heightPerSlotDp.toPx()).toInt() + passedSlotsLocal
                                    val start = slot * slotMinutes
                                    val end = start + slotMinutes
                                    dragStart = start
                                    viewModel.updateDayBlocks(start, end, dragStart!!)
                                    dragStart = null
                                }
                            }
                            .pointerInput(Unit) {
                                detectDragGestures(
                                    onDragStart = { offset ->
                                        val slot = (offset.y / heightPerSlotDp.toPx()).toInt() + passedSlotsLocal
                                        dragStart = slot * slotMinutes
                                        dragEnd = slot * slotMinutes
                                    },
                                    onDrag = { change, _ ->
                                        val slot = (change.position.y / heightPerSlotDp.toPx()).toInt() + passedSlotsLocal
                                        dragEnd = slot * slotMinutes
                                    },
                                    onDragEnd = {
                                        val start = minOf(dragStart ?: 0, dragEnd ?: 0)
                                        var end = maxOf(dragStart ?: 0, dragEnd ?: 0) + slotMinutes
                                        if (end > start) {
                                            end = minOf(end, 1440)
                                            viewModel.updateDayBlocks(start, end, dragStart!!)
                                        }
                                        dragStart = null
                                        dragEnd = null
                                    }
                                )
                            }
                    ) {
                        // Draw slot lines with quarter-hour markers
                        for (i in passedSlots..slots) {
                            val y = i * heightPerSlotDp.toPx() - passedSlots * heightPerSlotDp.toPx()
                            val isHour = i % (60 / slotMinutes) == 0
                            val isHalf = i % (30 / slotMinutes) == 0 && !isHour
                            val isQuarter = i % (15 / slotMinutes) == 0 && !isHour && !isHalf

                            val lineColor = when {
                                isHour -> Color.Gray
                                isHalf -> Color.LightGray
                                isQuarter -> Color.LightGray.copy(alpha = 0.5f)
                                else -> Color.Transparent
                            }

                            if (lineColor != Color.Transparent) {
                                val lineLength = when {
                                    isHour -> size.width
                                    isHalf -> size.width * 0.7f
                                    isQuarter -> size.width * 0.4f
                                    else -> size.width
                                }

                                drawLine(
                                    color = lineColor,
                                    start = Offset(0f, y),
                                    end = Offset(lineLength, y),
                                    strokeWidth = 1f
                                )
                            }
                        }

                        // Draw blocks
                        dayBlocks.forEach { block ->
                            val blockColor = block.color.copy(alpha = 0.6f)
                            val topSlot = block.startMinutes / slotMinutes
                            val bottomSlot = block.endMinutes / slotMinutes
                            val topY = topSlot * heightPerSlotDp.toPx() - passedSlots * heightPerSlotDp.toPx()
                            val bottomY = bottomSlot * heightPerSlotDp.toPx() - passedSlots * heightPerSlotDp.toPx()

                            drawRect(
                                color = blockColor,
                                topLeft = Offset(0f, topY),
                                size = androidx.compose.ui.geometry.Size(size.width, bottomY - topY)
                            )
                        }

                        // Draw dragging selection preview
                        if (dragStart != null && dragEnd != null) {
                            val topSlot = (minOf(dragStart!!, dragEnd!!)) / slotMinutes
                            val bottomSlot = (maxOf(dragStart!!, dragEnd!!)) / slotMinutes + 1
                            val topY = topSlot * heightPerSlotDp.toPx() - passedSlots * heightPerSlotDp.toPx()
                            val bottomY = bottomSlot * heightPerSlotDp.toPx() - passedSlots * heightPerSlotDp.toPx()
                            drawRect(
                                color = Color.LightGray.copy(alpha = 0.3f),
                                topLeft = Offset(0f, topY),
                                size = androidx.compose.ui.geometry.Size(size.width, bottomY - topY)
                            )
                        }
                    }
                }

                Column(
                    modifier = Modifier
                        .background(Color(240, 240, 240).copy(alpha = 0.3f))
                        .width(50.dp)
                        .height(totalHeight),
                    horizontalAlignment = Alignment.End
                ) { /* scroll area */ }
            }
        }

        // scroll bar
        val visibleHours = 6
        val proportionVisible = 1/4 //visibleMinutes / totalMinutes.toFloat()
        val scrollProportion = scrollState.value / scrollState.maxValue.toFloat().coerceAtLeast(1f)
        val indicatorHeight = 30.dp
        val indicatorOffset = scrollProportion * (1f - proportionVisible) / 1.8

        Column(
            modifier = Modifier
                .background(Color.LightGray.copy(alpha = 0.3f))
                .fillMaxWidth()
                .height(totalHeight / visibleHours * 60),
            horizontalAlignment = Alignment.End
        ) {
            // Scrollbar overlay
            Box(
                modifier = Modifier
                    .padding(end = 4.dp)
                    .width(6.dp)
            )

            // Movable visible-window indicator
            Box(
                modifier = Modifier
                    .padding(end = 4.dp)
                    .height(indicatorHeight)
                    .width(6.dp)
                    .offset(y = with(LocalDensity.current) {
                        (indicatorOffset * (scrollState.maxValue.toFloat() / density)).dp
                    })
                    .background(Color(0xFF1E88E5), shape = RoundedCornerShape(3.dp))
            )
        }
    }
}

@Composable
fun PreviewDayTimeline(
    navController: NavController,
    viewModel: AvailabilityViewModel
) {
    DayTimeline(navController,viewModel)
}
