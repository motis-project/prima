package de.motis.prima.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color

private val LightColorScheme = lightColorScheme(
    primary = Color(0xff5a4780),
    onPrimary = Color.White,
    background = Color(0xccfaf2fc),
    onBackground = Color.Black
)

private val DarkColorScheme = darkColorScheme(
    primary = Color(0xFFBB86FC),
    onPrimary = Color.Black,
    background = Color(0xff393147),
    onBackground = Color.White
)

data class ExtendedColors(
    val cardColor: Color,
    val markedCardColor: Color,
    val containerColor: Color
)

val LocalExtendedColors = staticCompositionLocalOf {
    ExtendedColors(
        cardColor = Color.Unspecified,
        markedCardColor = Color.Unspecified,
        containerColor = Color.Unspecified
    )
}

@Composable
fun MyAppTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    val colors = if (darkTheme) DarkColorScheme else LightColorScheme

    val extendedColors = if (darkTheme) {
        ExtendedColors(
            cardColor = Color(0xccc8c1d6),
            markedCardColor = Color(200, 255, 200),
            containerColor = Color(0xff6f697a)
        )
    } else {
        ExtendedColors(
            cardColor = Color(234, 232, 235),
            markedCardColor = Color(200, 255, 200),
            containerColor = Color(0xff6f697a)//Color(215, 207, 222)
        )
    }

    CompositionLocalProvider(LocalExtendedColors provides extendedColors) {
        MaterialTheme(
            colorScheme = colors,
            content = content
        )
    }
}
