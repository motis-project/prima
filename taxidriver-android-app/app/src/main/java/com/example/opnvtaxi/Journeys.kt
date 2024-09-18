package com.example.opnvtaxi

import android.os.Bundle
import android.util.Log
import androidx.activity.compose.setContent
import androidx.appcompat.app.AppCompatActivity
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.Card
import androidx.compose.material.Icon
import androidx.compose.material.Scaffold
import androidx.compose.material.Text
import androidx.compose.material.TextButton
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ExitToApp
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
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
import androidx.constraintlayout.compose.ConstraintLayout
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.navigation.NavHostController
import com.example.opnvtaxi.app.TaxidriverApp
import com.example.opnvtaxi.services.CookieStore
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.launch

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

class JourneysViewModel : ViewModel() {
    private val cookieStore: CookieStore = CookieStore(TaxidriverApp.instance)

    private val _logoutEvent = MutableSharedFlow<Unit>()
    val logoutEvent = _logoutEvent.asSharedFlow()

    fun logout() {
        viewModelScope.launch {
            try {
                cookieStore.clearCookies()
                _logoutEvent.emit(Unit)
            } catch (e: Exception) {
                Log.d("Logout", "Error while logout.")
            }
        }
    }
}

@Composable
fun Journeys(
    navController: NavHostController?,
    viewModel: JourneysViewModel = androidx.lifecycle.viewmodel.compose.viewModel()
) {

    LaunchedEffect(key1 = viewModel) {
        launch {
            viewModel.logoutEvent.collect {
                Log.d("Logout", "Logout event triggered.")
                navController?.navigate("login") {
                    popUpTo(navController.graph.startDestinationId) {
                        inclusive = true
                    }
                    launchSingleTop = true
                }
            }
        }
    }

    Scaffold(
        modifier = Modifier
            .fillMaxSize()
            .padding(
                top = 32.dp, bottom = 16.dp, start = 8.dp, end = 8.dp
            )
    ) { contentPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(contentPadding)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                // Disabled button to center text and align another button to the right
                TextButton(onClick = { }, enabled = false) {}
                Text(
                    text = stringResource(id = R.string.journeys_list_title), style = TextStyle(
                        color = Color.Black,
                        fontWeight = FontWeight.Bold,
                        fontSize = 18.sp,
                        textAlign = TextAlign.Center
                    )
                )
                TextButton(onClick = { viewModel.logout() }) {
                    Icon(
                        Icons.AutoMirrored.Outlined.ExitToApp, contentDescription = null
                    )
                }

            }

            val journeys = getJourneys()

            LazyColumn {
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
                        ConstraintLayout(modifier = Modifier.clickable {
                            navController?.navigate("journey/${j.id}")
                        }) {

                            val (leftColumn, rightColumn) = createRefs()

                            Column(
                                modifier = Modifier
                                    .fillMaxHeight()
                                    .padding(8.dp)
                                    .constrainAs(leftColumn) {
                                        start.linkTo(parent.start)
                                        top.linkTo(parent.top)
                                    }, verticalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text(
                                    text = j.subJourneys[0].startTime, style = TextStyle(
                                        color = Color.Black,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 14.sp,
                                        textAlign = TextAlign.Center
                                    )
                                )
                                Text(
                                    text = j.subJourneys[0].personName, style = TextStyle(
                                        color = Color.Black,
                                        fontSize = 12.sp,
                                        textAlign = TextAlign.Center
                                    )
                                )
                                Text(
                                    text = j.subJourneys[0].startLocation, style = TextStyle(
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
                                    }, horizontalAlignment = Alignment.End
                            ) {
                                Text(
                                    text = j.subJourneys.last().endTime, style = TextStyle(
                                        color = Color.Black,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 14.sp
                                    )
                                )
                                Text(
                                    text = getStopsText(j.subJourneys.size - 1), style = TextStyle(
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