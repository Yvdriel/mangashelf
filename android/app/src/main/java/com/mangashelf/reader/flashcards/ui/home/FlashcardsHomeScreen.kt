package com.mangashelf.reader.flashcards.ui.home

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import com.mudita.mmd.components.buttons.ButtonMMD
import com.mudita.mmd.components.text.TextMMD

const val FLASHCARDS_HOME_TAG = "flashcards-home"
const val FLASHCARDS_REVIEW_BTN_TAG = "flashcards-home-review"

/** Route wrapper for the Flashcards section landing (D3.3). Stateless; forwards nav callbacks. */
@Composable
fun FlashcardsHomeRoute(
    onReview: () -> Unit,
    onScheduler: () -> Unit,
    onHeatmap: () -> Unit,
    onImportExport: () -> Unit,
) {
    FlashcardsHomeScreen(onReview, onScheduler, onHeatmap, onImportExport)
}

/**
 * Flashcards section home (D3.3): the entries that used to live in the Library header row, relocated
 * into their own pillar. Review is the primary action; Scheduler / Heatmap / Import-Export follow.
 */
@Composable
fun FlashcardsHomeScreen(
    onReview: () -> Unit,
    onScheduler: () -> Unit,
    onHeatmap: () -> Unit,
    onImportExport: () -> Unit,
) {
    Column(
        Modifier.fillMaxSize().padding(16.dp).testTag(FLASHCARDS_HOME_TAG),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        TextMMD("Flashcards")
        Spacer(Modifier.height(4.dp))
        ButtonMMD(onClick = onReview, modifier = Modifier.fillMaxWidth().testTag(FLASHCARDS_REVIEW_BTN_TAG)) {
            TextMMD("Review")
        }
        ButtonMMD(onClick = onScheduler, modifier = Modifier.fillMaxWidth()) { TextMMD("Scheduler") }
        ButtonMMD(onClick = onHeatmap, modifier = Modifier.fillMaxWidth()) { TextMMD("Heatmap") }
        ButtonMMD(onClick = onImportExport, modifier = Modifier.fillMaxWidth()) { TextMMD("Import / Export") }
    }
}
