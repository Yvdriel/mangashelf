package com.mangashelf.reader.ui.downloads

import androidx.compose.runtime.Composable
import com.mangashelf.reader.ui.common.PlaceholderScreen

@Composable
fun DownloadsScreen(onBack: () -> Unit) {
    PlaceholderScreen(
        title = "Downloads",
        actions = listOf("Back" to onBack),
    )
}
