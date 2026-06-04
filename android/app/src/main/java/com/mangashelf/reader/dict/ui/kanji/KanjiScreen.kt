package com.mangashelf.reader.dict.ui.kanji

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Divider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.mangashelf.dict.data.model.KanjiDetail
import com.mangashelf.dict.data.model.TermHit
import com.mangashelf.reader.ui.theme.NotoSansJp
import com.mudita.mmd.components.buttons.ButtonMMD
import com.mudita.mmd.components.text.TextMMD

/** Route wrapper: binds the Hilt [KanjiViewModel] to the stateless [KanjiScreen]. */
@Composable
fun KanjiRoute(
    onOpenEntry: (Int) -> Unit,
    onBack: () -> Unit,
    viewModel: KanjiViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsState()
    KanjiScreen(state, onOpenEntry, onBack)
}

/**
 * D2.4 kanji-detail screen: big glyph, meanings, on/kun readings, KANJIDIC2 stats, and the "appears
 * in" compound list (tap a compound to open its entry). Stroke order (KanjiVG) is device-gated
 * (CH.11) — the SVG is NOT rendered here, only its asset path is surfaced for the device pass.
 * Stateless so it can be Compose-tested without Hilt.
 */
@Composable
fun KanjiScreen(
    state: KanjiUiState,
    onOpenEntry: (Int) -> Unit,
    onBack: () -> Unit,
) {
    Column(Modifier.fillMaxSize()) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp),
            horizontalArrangement = Arrangement.Start,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            ButtonMMD(onClick = onBack) { TextMMD("Back") }
        }
        when (state) {
            KanjiUiState.Loading -> Centered { TextMMD("Loading…") }
            KanjiUiState.NotFound -> Centered { TextMMD("Not found") }
            is KanjiUiState.Loaded -> LoadedContent(state.detail, onOpenEntry)
        }
    }
}

@Composable
private fun LoadedContent(detail: KanjiDetail, onOpenEntry: (Int) -> Unit) {
    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
    ) {
        Text(
            text = detail.character,
            fontFamily = NotoSansJp,
            fontSize = 72.sp,
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth(),
        )

        if (detail.meanings.isNotEmpty()) {
            Spacer(Modifier.height(12.dp))
            Text(detail.meanings.joinToString(", "))
        }

        if (detail.onyomi.isNotEmpty()) {
            Spacer(Modifier.height(8.dp))
            Row {
                Text("音 ")
                Text(detail.onyomi.joinToString("、"), fontFamily = NotoSansJp)
            }
        }
        if (detail.kunyomi.isNotEmpty()) {
            Spacer(Modifier.height(8.dp))
            Row {
                Text("訓 ")
                Text(detail.kunyomi.joinToString("、"), fontFamily = NotoSansJp)
            }
        }

        if (detail.stats.isNotEmpty()) {
            Spacer(Modifier.height(12.dp))
            detail.stats.forEach { (k, v) -> Text("$k: $v") }
        }

        // Stroke order (KanjiVG) is device-gated — see CH.11. Surface only the asset path here.
        Spacer(Modifier.height(12.dp))
        Text("Stroke order: device pass (CH.11)", fontSize = 13.sp)
        detail.kanjiVgAssetPath?.let { path ->
            Text(path, fontSize = 11.sp)
        }

        if (detail.compounds.isNotEmpty()) {
            Spacer(Modifier.height(12.dp))
            Divider()
            Spacer(Modifier.height(12.dp))
            Text("Appears in")
            Spacer(Modifier.height(4.dp))
            detail.compounds.take(20).forEach { hit ->
                CompoundRow(hit, onOpenEntry)
            }
        }
    }
}

@Composable
private fun CompoundRow(hit: TermHit, onOpenEntry: (Int) -> Unit) {
    Text(
        text = hit.record.expression,
        fontFamily = NotoSansJp,
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onOpenEntry(hit.record.sequence) }
            .padding(vertical = 6.dp),
    )
}

@Composable
private fun Centered(content: @Composable () -> Unit) {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { content() }
}
