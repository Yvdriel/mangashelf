package com.mangashelf.reader.ui.reader

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.mangashelf.dict.data.model.TermHit
import com.mangashelf.reader.dict.ui.render.StructuredContentText
import com.mangashelf.reader.ui.theme.NotoSansJp
import com.mudita.mmd.components.bottom_sheet.ModalBottomSheetMMD
import com.mudita.mmd.components.bottom_sheet.rememberModalBottomSheetMMDState
import com.mudita.mmd.components.buttons.ButtonMMD
import com.mudita.mmd.components.text.TextMMD

const val OCR_SHEET_TAG = "ocr-sheet"
const val OCR_CREATE_CARD_TAG = "ocr-create-card"

/**
 * O.3 lookup popup: an MMD modal bottom sheet showing the selected bubble's native crop, its
 * selectable OCR text, the dictionary-lookup pane ([OcrLookupPane] — a placeholder until D3.1), and
 * a "Create card" action that mines a flashcard via F.8. No early `return` (Compose group safety).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OcrLookupSheet(
    popup: OcrPopupState,
    onCreateCard: (TermHit?, Int?) -> Unit,
    onDismiss: () -> Unit,
) {
    val sheetState = rememberModalBottomSheetMMDState()
    ModalBottomSheetMMD(onDismissRequest = onDismiss, sheetState = sheetState) {
        Column(Modifier.fillMaxWidth().padding(16.dp).testTag(OCR_SHEET_TAG)) {
            val crop = popup.image
            if (crop != null) {
                Image(
                    bitmap = crop.asImageBitmap(),
                    contentDescription = "selected panel",
                    contentScale = ContentScale.Fit,
                    modifier = Modifier.fillMaxWidth().heightIn(max = 200.dp),
                )
                Spacer(Modifier.height(12.dp))
            }
            SelectionContainer {
                TextMMD(popup.sentence, fontFamily = NotoSansJp)
            }
            Spacer(Modifier.height(12.dp))
            OcrLookupPane(popup)
            Spacer(Modifier.height(16.dp))
            val status = popup.status
            if (status != null) {
                TextMMD(status)
                Spacer(Modifier.height(8.dp))
            }
            // Mines into the Mining notetype with the top resolved hit's cardBackHtml as the
            // Definition (non-blank back); falls back to a sentence+image card if nothing resolved.
            val topHit = popup.results.firstOrNull()?.hits?.firstOrNull()
            ButtonMMD(
                onClick = { onCreateCard(topHit, null) },
                modifier = Modifier.testTag(OCR_CREATE_CARD_TAG),
            ) {
                TextMMD("Create card")
            }
            Spacer(Modifier.height(12.dp))
        }
    }
}

/**
 * D3.1 dictionary-lookup pane: renders the `scan()` results (deinflected dictionary entries) using
 * the existing structured-content renderer. The deinflection reason chain is shown so a conjugated
 * bubble visibly resolves to its dictionary form.
 */
@Composable
private fun OcrLookupPane(popup: OcrPopupState) {
    when {
        popup.loading -> TextMMD("Looking up…")
        popup.results.isEmpty() -> TextMMD("No dictionary match.")
        else -> Column(Modifier.fillMaxWidth().testTag(OCR_RESULTS_TAG)) {
            popup.results.take(MAX_RESULTS).forEach { result ->
                result.hits.take(MAX_HITS_PER_RESULT).forEach { hit ->
                    HitRow(hit)
                    Spacer(Modifier.height(10.dp))
                }
            }
        }
    }
}

@Composable
private fun HitRow(hit: TermHit) {
    val record = hit.record
    Column(Modifier.fillMaxWidth()) {
        val head = if (record.reading.isNotBlank() && record.reading != record.expression) {
            "${record.expression} 【${record.reading}】"
        } else {
            record.expression
        }
        TextMMD(head, fontFamily = NotoSansJp, fontWeight = FontWeight.Bold, fontSize = 20.sp)
        if (hit.reasons.isNotEmpty()) {
            // e.g. 食べた → 食べる shown as "← past" (proves a non-base form resolved).
            TextMMD("← ${hit.reasons.joinToString(" · ")}", fontSize = 12.sp)
        }
        val pos = record.definitionTags.filter { it != "*" && it.isNotBlank() }.joinToString(" · ")
        if (pos.isNotBlank()) {
            TextMMD(pos, fontSize = 12.sp, fontWeight = FontWeight.Bold)
        }
        StructuredContentText(nodes = record.glossary, fontFamily = NotoSansJp)
    }
}

private const val MAX_RESULTS = 3
private const val MAX_HITS_PER_RESULT = 3
const val OCR_RESULTS_TAG = "ocr-results"
