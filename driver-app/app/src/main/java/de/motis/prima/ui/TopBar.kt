package de.motis.prima.ui

import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.CenterAlignedTopAppBar
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavController
import de.motis.prima.R
import de.motis.prima.ui.theme.LocalExtendedColors
import de.motis.prima.viewmodel.TopBarViewModel
import kotlinx.coroutines.launch

data class NavItem(
    val text: String,
    val action: () -> Unit
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TopBar(
    title: String,
    options: Boolean,
    navItems: List<NavItem>?,
    navController: NavController,
    viewModel: TopBarViewModel = hiltViewModel(),
) {
    LaunchedEffect(key1 = viewModel) {
        launch {
            viewModel.logoutEvent.collect {
                navController.navigate("login") {
                    launchSingleTop = true
                }
            }
        }
    }

    var dropdownExpanded by remember {
        mutableStateOf(false)
    }

    var showDialog by remember { mutableStateOf(false) }

    if (showDialog) {
        AlertDialog(
            onDismissRequest = { showDialog = false },
            title = { Text(text = "Benutzer abmelden", fontSize = 24.sp) },
            text = { Text(text = "Möchten Sie sich wirklich ausloggen?", fontSize = 16.sp) },
            icon = {
                Icon(
                    imageVector = Icons.Default.Warning,
                    contentDescription = "Localized description",
                    tint = Color.Black,
                    modifier = Modifier.size(32.dp)

                )
            },
            dismissButton = {
                Button(onClick = {
                    showDialog = false
                }) {
                    Text("Zurück")
                }
            },
            confirmButton = {
                Button(onClick = {
                    viewModel.stopPolling()
                    viewModel.logout()
                    showDialog = false
                }) {
                    Text("Abmelden")
                }
            }
        )
    }

    CenterAlignedTopAppBar(
        colors = TopAppBarDefaults.centerAlignedTopAppBarColors(
            containerColor = MaterialTheme.colorScheme.primaryContainer,
            titleContentColor = MaterialTheme.colorScheme.primary,
        ),
        title = {
            Text(
                text = title,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                color = LocalExtendedColors.current.textColor
            )
        },
        navigationIcon = {
            IconButton(onClick = {
                if (navController.previousBackStackEntry != null) {
                    navController.popBackStack()
                } else {
                    navController.navigate("tours")
                    viewModel.stopPolling()
                }
            }) {
                Icon(
                    imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                    contentDescription = "Localized description"
                )
            }
        },
        actions = {
            if (options && navItems != null) {
                IconButton(onClick = { dropdownExpanded = !dropdownExpanded }) {
                    Icon(Icons.Filled.MoreVert, contentDescription = "More Options")
                }
                DropdownMenu(
                    expanded = dropdownExpanded,
                    onDismissRequest = { dropdownExpanded = false }
                ) {
                    DropdownMenuItem(
                        onClick = {
                            navController.navigate("tours")
                            viewModel.stopPolling()
                        },
                        text = { Text(text = stringResource(id = R.string.tours_header)) }
                    )
                    DropdownMenuItem(
                        onClick = {
                            navController.navigate("availability")
                            viewModel.stopPolling()
                        },
                        text = { Text(text = stringResource(id = R.string.availability)) }
                    )
                    for (item in navItems) {
                        DropdownMenuItem(
                            onClick = {
                                viewModel.stopPolling()
                                dropdownExpanded = false
                                item.action()

                            },
                            text = { Text(text = item.text) }
                        )
                    }
                    DropdownMenuItem(
                        onClick = {
                            viewModel.toggleTheme()
                            dropdownExpanded = false

                        },
                        text = { Text(text = stringResource(id = R.string.toggle_theme)) }
                    )
                    DropdownMenuItem(
                        onClick = {
                            showDialog = true
                            dropdownExpanded = false

                        },
                        text = { Text(text = stringResource(id = R.string.logout)) }
                    )
                }
            }
        }
    )
}
