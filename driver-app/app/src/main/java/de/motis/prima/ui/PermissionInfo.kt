package de.motis.prima.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.wrapContentSize
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.Icon
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import de.motis.prima.R


@Composable
fun PermissionInfo() {
    Scaffold {
            contentPadding ->
        Column(
            Modifier.padding(contentPadding)
        ) {
            InfoCard(
                stringResource(id = R.string.camera_info_1),
                stringResource(id = R.string.camera_info_2)
            )
        }
    }
}

@Composable
fun InfoCard(
    text1: String,
    text2: String
) {
    Card(
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier
            .wrapContentSize()
            .padding(start = 24.dp, end = 24.dp, top = 60.dp, bottom = 0.dp)
    ) {
        Box(
            modifier = Modifier
                .padding(16.dp)
        ) {
            Column {
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
                Spacer(Modifier.height(24.dp))
                Text(
                    text = text1,
                    fontSize = 24.sp
                )
                Spacer(Modifier.height(24.dp))
                Text(
                    text = text2,
                    fontSize = 24.sp
                )
            }
        }
    }
}
