package de.motis.prima

import android.content.Intent
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.Icon
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewmodel.compose.viewModel
import de.motis.prima.app.DriversApp


class PermissionInfoViewModel : ViewModel() {
    fun restartApp() {
        val context = DriversApp.instance
        val packageManager = context.packageManager
        val intent = packageManager.getLaunchIntentForPackage(context.packageName)
        val componentName = intent!!.component
        val mainIntent = Intent.makeRestartActivityTask(componentName)
        // Required for API 34 and later
        // Ref: https://developer.android.com/about/versions/14/behavior-changes-14#safer-intents
        mainIntent.setPackage(context.packageName)
        context.startActivity(mainIntent)
        Runtime.getRuntime().exit(0)
    }
}

@Composable
fun PermissionInfo(
    viewModel: PermissionInfoViewModel = viewModel()
) {
    Scaffold {
            contentPadding ->
        Column(
            Modifier.padding(contentPadding)
        ) {
            Spacer(Modifier.height(100.dp))
            Card(
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(start = 24.dp, end = 24.dp, top = 60.dp, bottom = 0.dp)
                    .height(340.dp)
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(16.dp)
                ) {
                    Column {
                        Row {
                            Box (
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(10.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    painter = painterResource(id = R.drawable.ic_warning),
                                    contentDescription = "Localized description",
                                    Modifier
                                        .size(width = 64.dp, height = 64.dp)
                                )
                            }
                        }
                        Spacer(Modifier.height(24.dp))
                        Row {
                            Text(
                                "Ohne Zugriff auf die Kamera " +
                                        "kann die Prima+ÖV App nicht verwendet werden. ",
                                fontSize = 24.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                        Spacer(Modifier.height(24.dp))
                        Row {
                            Text(
                                "Bitte erlauben Sie den Zugriff in den Systemeinstellungen Ihres Gerätes.",
                                fontSize = 24.sp
                            )
                        }
                    }

                }
            }
            Spacer(Modifier.height(20.dp))
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(10.dp),
                contentAlignment = Alignment.Center
            ) {
                Button(onClick = { viewModel.restartApp() },
                    content = {
                        Text("Neu starten",
                            fontSize = 24.sp
                        )
                    }
                )
            }
        }
    }
}