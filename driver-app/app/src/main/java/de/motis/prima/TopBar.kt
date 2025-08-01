package de.motis.prima

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.MoreVert
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
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextOverflow
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavController
import de.motis.prima.theme.LocalExtendedColors
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

                        },
                        text = { Text(text = stringResource(id = R.string.tours_header)) }
                    )
                    for (item in navItems) {
                        DropdownMenuItem(
                            onClick = {
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
                        text = { Text(text = "Dark Theme") }
                    )
                    DropdownMenuItem(
                        onClick = {
                            viewModel.logout()
                            dropdownExpanded = false

                        },
                        text = { Text(text = stringResource(id = R.string.logout)) }
                    )
                }
            }
        }
    )
}
