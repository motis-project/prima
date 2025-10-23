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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
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
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import de.motis.prima.ui.AvailabilityViewModel
import java.time.LocalDate

data class TimeBlock(
    val date: LocalDate,
    val startMinutes: Int, // minutes since start of day
    val endMinutes: Int,
    val color: Color = Color.White
)

val colorAvailable = Color(254, 249, 195)
val colorTour = Color(251 ,146, 60)
val colorPassed = Color.LightGray

@Composable
fun DayTimeline(
    blocks: List<TimeBlock> = emptyList(),
    fetchedBlocks: List<TimeBlock> = emptyList(),
    onRangeSelected: (startMinutes: Int, endMinutes: Int, dragStart: Int, color: Color) -> Unit = { _, _, _, _ -> },
    viewModel: AvailabilityViewModel
) {
    val totalMinutes = 24 * 60
    val slotMinutes = 15
    val slots = totalMinutes / slotMinutes

    val passedHours = viewModel.currentHour
    val passedSlots = passedHours * 60 / slotMinutes

    var dragStart by remember { mutableStateOf<Int?>(null) }
    var dragEnd by remember { mutableStateOf<Int?>(null) }

    val scrollState = rememberScrollState()

    val displayDate by viewModel.displayDate.collectAsState()

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
                    for (hour in passedHours..24) {
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
                    Canvas(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(visibleHeight)
                            .padding(top = 12.dp, start = 6.dp, end = 12.dp)
                            .pointerInput(Unit) {
                                detectTapGestures { offset ->
                                    val slot = (offset.y / heightPerSlotDp.toPx()).toInt() + passedSlots
                                    val start = slot * slotMinutes
                                    val end = start + slotMinutes

                                    if (end > start) {
                                        onRangeSelected(start, end, start, colorAvailable)
                                    }
                                }
                            }
                            .pointerInput(Unit) {
                                detectDragGestures(
                                    onDragStart = { offset ->
                                        val slot = (offset.y / heightPerSlotDp.toPx()).toInt() + passedSlots
                                        dragStart = slot * slotMinutes
                                        dragEnd = slot * slotMinutes
                                    },
                                    onDrag = { change, _ ->
                                        val slot = (change.position.y / heightPerSlotDp.toPx()).toInt() + passedSlots
                                        dragEnd = slot * slotMinutes
                                    },
                                    onDragEnd = {
                                        val start = minOf(dragStart ?: 0, dragEnd ?: 0)
                                        val end = maxOf(dragStart ?: 0, dragEnd ?: 0) + slotMinutes
                                        if (end > start) {
                                            onRangeSelected(start, end, dragStart!!, colorAvailable)
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
                        val allBlocks = fetchedBlocks + blocks
                        allBlocks.filter { b -> b.date == displayDate }.forEach { block ->
                            val topSlot = block.startMinutes / slotMinutes
                            val bottomSlot = block.endMinutes / slotMinutes
                            val topY = topSlot * heightPerSlotDp.toPx() - passedSlots * heightPerSlotDp.toPx()
                            val bottomY = bottomSlot * heightPerSlotDp.toPx() - passedSlots * heightPerSlotDp.toPx()

                            drawRect(
                                color = block.color.copy(alpha = 0.6f),
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
        val visibleMinutes = visibleHours * 60
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
    viewModel: AvailabilityViewModel
) {
    var blocks by remember { mutableStateOf(listOf<TimeBlock>()) }
    val fetchedBlocks by viewModel.availability.collectAsState()

    DayTimeline(
        blocks = blocks,
        fetchedBlocks = fetchedBlocks,
        onRangeSelected = { start, end, dragStart, color ->
            val removeFetched = fetchedBlocks.contains(TimeBlock(viewModel.displayDate.value, dragStart, dragStart + 15, color))
            val removeInput = blocks.contains(TimeBlock(viewModel.displayDate.value, dragStart, dragStart + 15, color))
            val tmpFetched = fetchedBlocks.toMutableList()
            val tmpInput = blocks.toMutableList()
            var a = start
            while ( a < end ) {
                val b = a + 15
                val newBlock = TimeBlock(viewModel.displayDate.value, a, b, color)
                if (removeFetched || removeInput) {
                    tmpFetched.remove(newBlock)
                    tmpInput.remove(newBlock)
                    blocks = tmpInput
                } else {
                    if (blocks.contains(newBlock).not()) {
                        blocks = blocks + newBlock
                    }
                }
                a = b
            }
            if (removeFetched || removeInput) {
                viewModel.setBlocks(tmpFetched)
            }
        },
        viewModel
    )
}
