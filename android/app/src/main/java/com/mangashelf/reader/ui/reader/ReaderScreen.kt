package com.mangashelf.reader.ui.reader

import androidx.compose.runtime.Composable
import com.mangashelf.reader.ui.common.PlaceholderScreen

@Composable
fun ReaderScreen(onBack: () -> Unit) {
    PlaceholderScreen(
        title = "Reader",
        actions = listOf("Back" to onBack),
    )
}
