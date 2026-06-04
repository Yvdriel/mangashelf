package com.mangashelf.reader.ui.settings

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.compose.runtime.LaunchedEffect
import com.mudita.mmd.components.buttons.ButtonMMD
import com.mudita.mmd.components.text.TextMMD

/** Route wrapper: binds [SettingsViewModel] and routes to Onboarding after a server change (CH.8/6.2). */
@Composable
fun SettingsRoute(
    onBack: () -> Unit,
    onReonboard: () -> Unit,
    viewModel: SettingsViewModel = hiltViewModel(),
) {
    val serverUrl by viewModel.serverUrl.collectAsState()
    val reonboard by viewModel.reonboard.collectAsState()
    LaunchedEffect(reonboard) {
        if (reonboard) onReonboard()
    }
    SettingsScreen(
        serverUrl = serverUrl,
        onSyncNow = viewModel::syncNow,
        onClearCache = viewModel::clearCache,
        onChangeServer = viewModel::changeServer,
        onBack = onBack,
    )
}

/**
 * Settings: current server, Sync now, Clear cache, and a destructive Change-server that purges the
 * cache + credentials and returns to Onboarding (gated by an inline confirmation). Stateless for test.
 */
@Composable
fun SettingsScreen(
    serverUrl: String?,
    onSyncNow: () -> Unit,
    onClearCache: () -> Unit,
    onChangeServer: () -> Unit,
    onBack: () -> Unit,
) {
    var confirming by remember { mutableStateOf(false) }

    Column(Modifier.fillMaxSize().padding(16.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            ButtonMMD(onClick = onBack) { TextMMD("Back") }
            TextMMD("Settings")
        }
        Spacer(Modifier.height(16.dp))

        TextMMD("Server")
        TextMMD(serverUrl ?: "Not connected")
        Spacer(Modifier.height(24.dp))

        ButtonMMD(onClick = onSyncNow) { TextMMD("Sync now") }
        Spacer(Modifier.height(8.dp))
        ButtonMMD(onClick = onClearCache) { TextMMD("Clear cache") }
        Spacer(Modifier.height(8.dp))

        if (confirming) {
            TextMMD("Change server erases all downloaded volumes and signs out. Continue?")
            Spacer(Modifier.height(8.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                ButtonMMD(onClick = { confirming = false; onChangeServer() }) { TextMMD("Erase & change") }
                Spacer(Modifier.width(8.dp))
                ButtonMMD(onClick = { confirming = false }) { TextMMD("Cancel") }
            }
        } else {
            ButtonMMD(onClick = { confirming = true }) { TextMMD("Change server") }
        }
    }
}
