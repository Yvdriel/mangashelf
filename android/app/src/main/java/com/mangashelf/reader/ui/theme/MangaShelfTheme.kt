package com.mangashelf.reader.ui.theme

import androidx.compose.runtime.Composable
import com.mudita.mmd.ThemeMMD
import com.mudita.mmd.eInkColorScheme
import com.mudita.mmd.eInkTypography

/**
 * App theme on top of Mudita Mindful Design. Monochrome e-ink color scheme,
 * e-ink typography, no ripple/motion (MMD disables these by default). Reader/
 * flashcard/dict screens all render under this.
 */
@Composable
fun MangaShelfTheme(content: @Composable () -> Unit) {
    ThemeMMD(
        colorScheme = eInkColorScheme,
        typography = eInkTypography,
        content = content,
    )
}
