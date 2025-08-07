package de.motis.prima.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import dagger.hilt.android.lifecycle.HiltViewModel
import de.motis.prima.data.DataRepository
import javax.inject.Inject

private val LightColorScheme = lightColorScheme(
    primary = Color(215, 207, 222),//Color(0xff5a4780),
    onPrimary = Color(0xff393147),
    background = Color(0xfffaf2fc),
    onBackground = Color.Black
)

private val DarkColorScheme = darkColorScheme(
    primary = Color(0xff5a4780),
    onPrimary = Color.White,
    background = Color(0xff393147),
    onBackground = Color.White
)

data class ExtendedColors(
    val cardColor: Color,
    val markedCardColor: Color,
    val containerColor: Color,
    val textColor: Color,
    val secondaryButton: Color
)

val LocalExtendedColors = staticCompositionLocalOf {
    ExtendedColors(
        cardColor = Color.Unspecified,
        markedCardColor = Color.Unspecified,
        containerColor = Color.Unspecified,
        textColor = Color.Unspecified,
        secondaryButton = Color.Unspecified
    )
}

@HiltViewModel
class ThemeViewModel @Inject constructor(
    repository: DataRepository
) : ViewModel() {
    val darkTheme = repository.darkTheme
}

@Composable
fun MyAppTheme(
    content: @Composable () -> Unit,
    viewModel: ThemeViewModel = hiltViewModel()
) {
    val darkTheme = viewModel.darkTheme.collectAsState()
    val colors = if (darkTheme.value) DarkColorScheme else LightColorScheme

    val extendedColors = if (darkTheme.value) {
        ExtendedColors(
            cardColor = Color(0xff453f52),
            markedCardColor = Color.Green,
            containerColor = Color(0xff56515e),
            textColor = Color.White,
            secondaryButton = Color(0xff5a4780)
        )
    } else {
        ExtendedColors(
            cardColor = Color(234, 232, 235),
            markedCardColor = Color(200, 255, 200),
            containerColor = Color.White,
            textColor = Color.Black,
            secondaryButton = Color(215, 207, 222)
        )
    }

    CompositionLocalProvider(LocalExtendedColors provides extendedColors) {
        MaterialTheme(
            colorScheme = colors,
            content = content
        )
    }
}
