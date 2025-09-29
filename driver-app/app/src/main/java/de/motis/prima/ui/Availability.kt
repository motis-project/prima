package de.motis.prima.ui

import PreviewDayTimeline
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.navigation.NavController
import de.motis.prima.R

@Composable
fun Availability(
    navController: NavController,
) {
    Scaffold(
        topBar = {
            TopBar(
                stringResource(id = R.string.vehicles_header),
                true,
                listOf(
                    NavItem(
                        text = stringResource(id = R.string.reload),
                        action = { navController.navigate("vehicles") }
                    )
                ),
                navController
            )
        }
    ) { contentPadding ->
        Box(modifier = Modifier.padding(contentPadding)) {
            PreviewDayTimeline()
        }
    }
}
