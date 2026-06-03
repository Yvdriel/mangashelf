package com.mangashelf.reader.ui.common

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.mudita.mmd.components.buttons.ButtonMMD
import com.mudita.mmd.components.text.TextMMD

/**
 * 2.1 scaffolding: a titled placeholder destination with MMD nav buttons.
 * Real screens replace these in Phase 2.3+ (onboarding), 3.3/3.4 (library/detail),
 * Phase 4 (reader), 5.2 (downloads), 6.2 (settings).
 */
@Composable
fun PlaceholderScreen(
    title: String,
    actions: List<Pair<String, () -> Unit>> = emptyList(),
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        TextMMD(title)
        actions.forEach { (label, onClick) ->
            Spacer(Modifier.height(16.dp))
            ButtonMMD(onClick = onClick) { TextMMD(label) }
        }
    }
}
