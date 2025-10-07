import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

data class TimeBlock(
    val startMinutes: Int, // minutes since start of day
    val endMinutes: Int,
    val color: Color = Color.Blue
)

@Composable
fun DayTimeline(
    modifier: Modifier = Modifier,
    blocks: List<TimeBlock> = emptyList(),
    onRangeSelected: (startMinutes: Int, endMinutes: Int) -> Unit = { _, _ -> }
) {
    val totalMinutes = 24 * 60
    val slotMinutes = 15
    val slots = totalMinutes / slotMinutes

    var dragStart by remember { mutableStateOf<Int?>(null) }
    var dragEnd by remember { mutableStateOf<Int?>(null) }

    val scrollState = rememberScrollState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(scrollState)
    ) {
        Row(
            modifier = modifier
                .background(Color.White)
        ) {
            // Hour labels column
            Column(
                modifier = Modifier
                    .width(50.dp)
                    .height(3000.dp),
                horizontalAlignment = Alignment.End
            ) {
                //for (hour in 8..12) {
                for (hour in 0..24) {
                    Box(
                        modifier = Modifier
                            .weight(60f / slotMinutes) // 60 minutes worth of slots
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
            BoxWithConstraints(modifier = Modifier.weight(1f)) {
                val heightPerSlot = maxHeight / slots

                Canvas(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(heightPerSlot * slots)
                        .pointerInput(Unit) {
                            detectTapGestures { offset ->
                                val slot = (offset.y / heightPerSlot.toPx()).toInt()
                                val start = slot * slotMinutes
                                val end = start + slotMinutes

                                if (end > start) {
                                    onRangeSelected(start, end)
                                }
                            }
                        }
                        .pointerInput(Unit) {
                            detectDragGestures(
                                onDragStart = { offset ->
                                    val slot = (offset.y / heightPerSlot.toPx()).toInt()
                                    dragStart = slot * slotMinutes
                                    dragEnd = slot * slotMinutes
                                },
                                onDrag = { change, _ ->
                                    val slot = (change.position.y / heightPerSlot.toPx()).toInt()
                                    dragEnd = slot * slotMinutes
                                },
                                onDragEnd = {
                                    val start = minOf(dragStart ?: 0, dragEnd ?: 0)
                                    val end = maxOf(dragStart ?: 0, dragEnd ?: 0) + slotMinutes
                                    if (end > start) {
                                        onRangeSelected(start, end)
                                    }
                                    dragStart = null
                                    dragEnd = null
                                }
                            )
                        }
                ) {
                    // Draw slot lines with quarter-hour markers
                    for (i in 0..slots) {
                        val y = i * heightPerSlot.toPx()
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
                    blocks.forEach { block ->
                        val topSlot = block.startMinutes / slotMinutes
                        val bottomSlot = block.endMinutes / slotMinutes
                        val topY = topSlot * heightPerSlot.toPx()
                        val bottomY = bottomSlot * heightPerSlot.toPx()

                        drawRect(
                            color = block.color.copy(alpha = 0.6f),
                            topLeft = Offset(0f, topY),
                            size = androidx.compose.ui.geometry.Size(size.width, bottomY - topY)
                        )
                    }

                    // Draw dragging selection preview
                    if (dragStart != null && dragEnd != null) {
                        val startSlot = (minOf(dragStart!!, dragEnd!!)) / slotMinutes
                        val endSlot = (maxOf(dragStart!!, dragEnd!!)) / slotMinutes + 1
                        val topY = startSlot * heightPerSlot.toPx()
                        val bottomY = endSlot * heightPerSlot.toPx()

                        drawRect(
                            color = Color.LightGray.copy(alpha = 0.3f),
                            topLeft = Offset(0f, topY),
                            size = androidx.compose.ui.geometry.Size(size.width, bottomY - topY)
                        )
                    }
                }
            }

            // Hour labels column
            Column(
                modifier = Modifier
                    .background(color = Color.LightGray)
                    .width(50.dp)
                    .height(3000.dp),
                horizontalAlignment = Alignment.End
            ) {
                // scroll area
            }
        }
    }
}

@Composable
fun PreviewDayTimeline() {
    var blocks by remember { mutableStateOf(listOf<TimeBlock>()) }

    DayTimeline(
        modifier = Modifier
            .fillMaxSize(),
        blocks = blocks,
        onRangeSelected = { start, end ->
            var a = start
            while ( a < end ) {
                val b = a + 15
                val newBlock = TimeBlock(a, b, Color.Yellow)
                if (blocks.contains(newBlock)) {
                    val tmp = blocks.toMutableList()
                    tmp.remove(newBlock)
                    blocks = tmp
                } else {
                    blocks = blocks + newBlock
                }
                a = b
            }
        }
    )
}
