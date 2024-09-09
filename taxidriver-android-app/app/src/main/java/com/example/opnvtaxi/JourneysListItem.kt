package com.example.opnvtaxi

import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.appcompat.app.AppCompatActivity
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.Card
import androidx.compose.material.Icon
import androidx.compose.material.Text
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInWindow
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.zIndex
import androidx.constraintlayout.compose.ConstraintLayout
import androidx.navigation.NavHostController
import androidx.navigation.compose.rememberNavController


class JourneysListItemActivity(private val navController: NavHostController) : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            JourneysListItem(
                navController = navController,
                journey = getJourneys()[0]
            )
        }
    }
}

@Composable
@Suppress("UNUSED_PARAMETER")
fun JourneysListItem(navController: NavHostController, journey: Journey) {

    val topPadding = 16.dp

    var lineStartPosition by remember { mutableStateOf(Offset.Zero) }
    var lineEndPosition by remember { mutableStateOf(Offset.Zero) }

    Column(
        modifier = Modifier.padding(topPadding)
    ) {

        Text(
            modifier = Modifier
                .fillMaxWidth(),
            text = "${stringResource(R.string.single_journey)} ${journey.id}",
            style = TextStyle(
                color = Color.Black,
                fontWeight = FontWeight.Bold,
                fontSize = 18.sp,
                textAlign = TextAlign.Center
            )
        )

        Card(
            shape = RoundedCornerShape(4.dp),
            backgroundColor = Color(0xFFDADADA),
            modifier = Modifier
                .fillMaxWidth()
                .padding(8.dp)
                .height(150.dp)
        ) {
            ConstraintLayout {
                val (tripStart, tripEnd) = createRefs()

                Canvas(modifier = Modifier.zIndex(1f)) {
                    drawLine(
                        brush = Brush.horizontalGradient(),
                        start = lineStartPosition - Offset(-20f, 100f),
                        end = lineEndPosition - Offset(90f, 100f),
                        strokeWidth = 5f,
                        cap = StrokeCap.Round
                    )
                }

                // Start Point
                Column(
                    modifier = Modifier
                        .fillMaxHeight()
                        .padding(8.dp)
                        .width(120.dp)
                        .constrainAs(tripStart) {
                            start.linkTo(parent.start)
                            top.linkTo(parent.top)
                        },
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Icon(
                        Icons.Default.LocationOn,
                        contentDescription = null,
                        modifier = Modifier.onGloballyPositioned { layoutCoordinates ->
                            lineStartPosition = layoutCoordinates.positionInWindow()
                        }
                    )
                    Text(
                        text = journey.subJourneys[0].startLocation,
                        style = TextStyle(
                            color = Color.Black,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            textAlign = TextAlign.Center
                        )
                    )
                    Text(
                        text = journey.subJourneys[0].startTime,
                        style = TextStyle(
                            fontSize = 12.sp,
                            textAlign = TextAlign.Center
                        )
                    )
                    //TODO: could be a list of persons, only on the left site on start
                    //Eine Person kann länger im Fahrzeug bleiben, als nur eine Station
                    Text(
                        text = journey.subJourneys[0].personName,
                        style = TextStyle(
                            fontSize = 12.sp,
                            textAlign = TextAlign.Center
                        )
                    )

                    // Der Fahrer muss auswählen können, welche Personen eingestiegen sind
                    // Es können 0 Personen sein
                }

                // End Point
                Column(
                    modifier = Modifier
                        .fillMaxHeight()
                        .padding(8.dp)
                        .width(120.dp)
                        .constrainAs(tripEnd) {
                            end.linkTo(parent.end)
                            top.linkTo(parent.top)
                        },
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Icon(
                        Icons.Default.LocationOn,
                        contentDescription = null,
                        modifier = Modifier.onGloballyPositioned { layoutCoordinates ->
                            lineEndPosition = layoutCoordinates.positionInWindow()
                        }
                    )
                    Text(
                        text = journey.subJourneys[0].endLocation,
                        style = TextStyle(
                            color = Color.Black,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            textAlign = TextAlign.Center
                        )
                    )
                    Text(
                        text = journey.subJourneys[0].endTime,
                        style = TextStyle(
                            fontSize = 12.sp,
                            textAlign = TextAlign.Center
                        )
                    )
                    Text(
                        text = journey.subJourneys[0].personName,
                        style = TextStyle(
                            fontSize = 12.sp,
                            textAlign = TextAlign.Center
                        )
                    )
                    // Ausstieg Button - wie viel Personen ausgestiegen sind
                    // Wenig Fehler
                    // Switch zur Startaddresse

                    // Am Ende der Verkettung muss der Fahrzeug leer sein.
                    // Potenziell für Statistik einen API Call einbauen mit Anzahl an Personen am Ende der Verkettung
                }
            }
        }
    }
}

@Preview
@Composable
fun JourneysListItemPreview() {
    val navController = rememberNavController()
    JourneysListItem(
        navController = navController,
        journey = getJourneys()[0]
    )
}