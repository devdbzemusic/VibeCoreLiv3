package com.vibecore.app.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

/**
 * Compose translation of the existing VibeCoreLiv3 CSS design tokens.
 * This is a parity layer, not a redesign.
 */
object VibeCoreColors {
    val Background = Color(0xFF050812)
    val Surface0 = Color(0xFF050812)
    val Surface1 = Color(0xFF0B101C)
    val Surface2 = Color(0xFF101827)
    val Surface3 = Color(0xFF172235)
    val SurfaceElevated = Color(0xFF21304A)

    val Foreground = Color(0xFFD6F8FF)
    val Muted = Color(0xFF8291AA)
    val Border = Color(0xFF1E3147)

    val Primary = Color(0xFF1ACFFF)
    val PrimaryGlow = Color(0xFF4DE5FF)
    val Violet = Color(0xFFAD66FF)
    val Magenta = Color(0xFFFF33B8)
    val Lime = Color(0xFF33FF66)
    val Amber = Color(0xFFFFB52B)
    val Crimson = Color(0xFFFF3355)

    val Kick = Crimson
    val Snare = Amber
    val Perc = Color(0xFFFFD51A)
    val Hat = Lime
    val Bass = Primary
    val Synth = Violet
    val Sample = Magenta
}

private val VibeCoreScheme = darkColorScheme(
    primary = VibeCoreColors.Primary,
    onPrimary = VibeCoreColors.Background,
    secondary = VibeCoreColors.Violet,
    onSecondary = VibeCoreColors.Background,
    tertiary = VibeCoreColors.Magenta,
    background = VibeCoreColors.Background,
    onBackground = VibeCoreColors.Foreground,
    surface = VibeCoreColors.Surface1,
    onSurface = VibeCoreColors.Foreground,
    surfaceVariant = VibeCoreColors.Surface2,
    onSurfaceVariant = VibeCoreColors.Muted,
    outline = VibeCoreColors.Border,
    error = VibeCoreColors.Crimson,
)

@Composable
fun VibeCoreTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = VibeCoreScheme,
        content = content,
    )
}
