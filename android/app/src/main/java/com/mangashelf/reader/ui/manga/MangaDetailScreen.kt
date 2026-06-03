package com.mangashelf.reader.ui.manga

import androidx.compose.runtime.Composable
import com.mangashelf.reader.ui.common.PlaceholderScreen

@Composable
fun MangaDetailScreen(
    onRead: () -> Unit,
    onBack: () -> Unit,
) {
    PlaceholderScreen(
        title = "Manga detail",
        actions = listOf(
            "Read" to onRead,
            "Back" to onBack,
        ),
    )
}
