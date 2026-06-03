package com.mangashelf.reader.ui.library

import androidx.compose.runtime.Composable
import com.mangashelf.reader.ui.common.PlaceholderScreen

@Composable
fun LibraryScreen(
    onOpenManga: () -> Unit,
    onDownloads: () -> Unit,
    onSettings: () -> Unit,
) {
    PlaceholderScreen(
        title = "Library",
        actions = listOf(
            "Open manga" to onOpenManga,
            "Downloads" to onDownloads,
            "Settings" to onSettings,
        ),
    )
}
