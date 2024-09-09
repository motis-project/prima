package com.example.opnvtaxi

import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.appcompat.app.AppCompatActivity
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.Card
import androidx.compose.material.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
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

class JourneysActivity(private val navController: NavHostController) : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            Journeys(
                navController = this.navController
            )
        }
    }
}

@Composable
fun Journeys(navController: NavHostController?) {

    val topPadding = 16.dp

    Text(
        modifier = Modifier
            .fillMaxWidth()
            .padding(topPadding)
            .zIndex(1f)
            .background(Color.White),
        text = stringResource(id = R.string.journeys_list_title),
        style = TextStyle(
            color = Color.Black,
            fontWeight = FontWeight.Bold,
            fontSize = 18.sp,
            textAlign = TextAlign.Center
        )
    )

    val journeys = getJourneys()

    LazyColumn(
        modifier = Modifier,
        contentPadding = PaddingValues(
            top = 24.dp + topPadding,
            bottom = 24.dp,
            start = 8.dp,
            end = 8.dp
        )
    ) {
        items(items = journeys, itemContent = { j ->
            // TODO: Verkettung mit einem Symbol zeigen?
            Card(
                shape = RoundedCornerShape(4.dp),
                backgroundColor = Color(0xFFDADADA),
                modifier = Modifier
                    .fillParentMaxWidth()
                    .padding(8.dp)
                    .height(80.dp)
            ) {
                ConstraintLayout(
                    modifier = Modifier.clickable {
                        navController?.navigate("journey/${j.id}")
                    }
                ) {

                    val (leftColumn, rightColumn) = createRefs()

                    Column(
                        modifier = Modifier
                            .fillMaxHeight()
                            .padding(8.dp)
                            .constrainAs(leftColumn) {
                                start.linkTo(parent.start)
                                top.linkTo(parent.top)
                            },
                        verticalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            text = j.subJourneys[0].startTime,
                            style = TextStyle(
                                color = Color.Black,
                                fontWeight = FontWeight.Bold,
                                fontSize = 14.sp,
                                textAlign = TextAlign.Center
                            )
                        )
                        Text(
                            text = j.subJourneys[0].personName,
                            style = TextStyle(
                                color = Color.Black,
                                fontSize = 12.sp,
                                textAlign = TextAlign.Center
                            )
                        )
                        Text(
                            text = j.subJourneys[0].startLocation,
                            style = TextStyle(
                                color = Color.Black,
                                fontSize = 12.sp,
                                textAlign = TextAlign.Center
                            )
                        )
                    }
                    Column(
                        modifier = Modifier
                            .fillMaxHeight()
                            .padding(8.dp)
                            .constrainAs(rightColumn) {
                                end.linkTo(parent.end)
                                top.linkTo(parent.top)
                            },
                        horizontalAlignment = Alignment.End
                    ) {
                        Text(
                            text = j.subJourneys.last().endTime,
                            style = TextStyle(
                                color = Color.Black,
                                fontWeight = FontWeight.Bold,
                                fontSize = 14.sp
                            )
                        )
                        Text(
                            text = getStopsText(j.subJourneys.size - 1),
                            style = TextStyle(
                                color = Color.Black,
                                fontSize = 12.sp,
                                textAlign = TextAlign.Center
                            )
                        )
                    }
                }
            }
        })
    }
}

@Preview
@Composable
fun JourneysPreview() {
    Journeys(
        navController = null
    )
}

fun getStopsText(stopCount: Int): String {
    return when (stopCount) {
        0 -> {
            "Keine Stops"
        }

        1 -> {
            "1 Stop"
        }

        else -> {
            "$stopCount Stops"
        }
    }
}