package com.mangashelf.reader.ui.settings

import androidx.compose.runtime.Composable
import com.mangashelf.reader.ui.common.PlaceholderScreen

@Composable
fun SettingsScreen(onBack: () -> Unit) {
    PlaceholderScreen(
        title = "Settings",
        actions = listOf("Back" to onBack),
    )
}
