import android.util.Log
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectDragGesturesAfterLongPress
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

// Data class for a time block
data class TimeBlock(
    val startMinutes: Int,
    val endMinutes: Int,
    val color: Color = Color.Blue
)

@Composable
fun DayTimeline(
    modifier: Modifier = Modifier,
    blocks: List<TimeBlock>,
    onBlocksChange: (List<TimeBlock>) -> Unit = {}
) {
    val totalMinutes = 6 * 60 //24 * 60
    val slotMinutes = 15
    val slots = totalMinutes / slotMinutes

    var blocksTmp: List<TimeBlock> = emptyList()

    var activeBlockIndex by remember { mutableStateOf<Int?>(null) }
    var isResizingBottom by remember { mutableStateOf(false) }
    var isResizingTop by remember { mutableStateOf(false) }

    val handleHeight = 8.dp

    Row(modifier = modifier.background(Color.White)) {
        // Hour labels column
        Column(
            modifier = Modifier
                .width(50.dp)
                .fillMaxHeight(),
            horizontalAlignment = Alignment.End
        ) {
            for (hour in 6..12) { //0..24
                Box(
                    modifier = Modifier
                        .weight(60f / slotMinutes)
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
                    .fillMaxSize()
                    .pointerInput(Unit) {
                        detectTapGestures(onTap = { offset ->
                            val slot = (offset.y / heightPerSlot.toPx()).toInt()
                            val startMinutes = slot * slotMinutes
                            val newBlock = TimeBlock(startMinutes, startMinutes + slotMinutes, Color.Yellow)
                            val updated = blocks + newBlock
                            Log.d("test", "tap, updated: $updated")
                            onBlocksChange(updated)
                            activeBlockIndex = if (updated.lastIndex > 0) updated.lastIndex else 0
                            Log.d("test", "activeBlockIndex: $activeBlockIndex")
                        })
                    }
                    .pointerInput(Unit) {
                        detectDragGesturesAfterLongPress(
                            onDragStart = { offset ->
                                activeBlockIndex?.let { index ->
                                    Log.d("test","$index")
                                    val block = blocksTmp[index]
                                    val topY = (block.startMinutes / slotMinutes) * heightPerSlot.toPx()
                                    val bottomY = (block.endMinutes / slotMinutes) * heightPerSlot.toPx()

                                    val topHandleBottom = topY + handleHeight.toPx()
                                    val bottomHandleTop = bottomY - handleHeight.toPx()

                                    when {
                                        offset.y in topY..topHandleBottom -> isResizingTop = true
                                        offset.y in bottomHandleTop..bottomY -> isResizingBottom = true
                                    }
                                }
                            },
                            onDrag = { change, dragAmount ->
                                activeBlockIndex?.let { index ->
                                    val block = blocksTmp[index]
                                    if (isResizingBottom) {
                                        Log.d("test", "isResizingBottom")
                                        val deltaSlots = (dragAmount.y / heightPerSlot.toPx()).toInt()
                                        val newEnd = (block.endMinutes + deltaSlots * slotMinutes)
                                            .coerceAtMost(totalMinutes)
                                            .coerceAtLeast(block.startMinutes + slotMinutes)
                                        val updatedBlock = block.copy(endMinutes = newEnd)
                                        val updated = blocksTmp.toMutableList().apply { this[index] = updatedBlock }
                                        onBlocksChange(updated)
                                    } else if (isResizingTop) {
                                        Log.d("test", "isResizingTop")
                                        val deltaSlots = (dragAmount.y / heightPerSlot.toPx()).toInt()
                                        val newStart = (block.startMinutes + deltaSlots * slotMinutes)
                                            .coerceAtLeast(0)
                                            .coerceAtMost(block.endMinutes - slotMinutes)
                                        val updatedBlock = block.copy(startMinutes = newStart)
                                        val updated = blocksTmp.toMutableList().apply { this[index] = updatedBlock }
                                        onBlocksChange(updated)
                                    }
                                }
                            },
                            onDragEnd = {
                                isResizingBottom = false
                                isResizingTop = false
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
                blocks.forEachIndexed { index, block ->
                    val topSlot = block.startMinutes / slotMinutes
                    val bottomSlot = block.endMinutes / slotMinutes
                    val topY = topSlot * heightPerSlot.toPx()
                    val bottomY = bottomSlot * heightPerSlot.toPx()

                    val blockColor = if (index == activeBlockIndex) block.color else block.color.copy(alpha = 0.4f)

                    // Draw the block
                    drawRect(
                        color = blockColor,
                        topLeft = Offset(0f, topY),
                        size = Size(size.width, bottomY - topY)
                    )

                    // Draw handles if active
                    if (index == activeBlockIndex) {
                        // Top handle
                        drawRect(
                            color = Color.DarkGray,
                            topLeft = Offset(size.width / 4f, topY),
                            size = Size(size.width / 2f, handleHeight.toPx())
                        )
                        // Bottom handle
                        drawRect(
                            color = Color.DarkGray,
                            topLeft = Offset(size.width / 4f, bottomY - handleHeight.toPx()),
                            size = Size(size.width / 2f, handleHeight.toPx())
                        )
                    }
                }
            }
        }
    }
}

// Example usage
@Composable
fun PreviewDayTimeline() {
    var blocks by remember { mutableStateOf(listOf<TimeBlock>()) }

    DayTimeline(
        modifier = Modifier
            .fillMaxWidth()
            .height(800.dp),
        blocks = blocks,
        onBlocksChange = { updated -> blocks = updated }
    )
}