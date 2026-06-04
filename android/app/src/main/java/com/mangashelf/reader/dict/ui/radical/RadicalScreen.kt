package com.mangashelf.reader.dict.ui.radical

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.mangashelf.reader.ui.theme.NotoSansJp
import com.mudita.mmd.components.buttons.ButtonMMD
import com.mudita.mmd.components.text.TextMMD

/** Route wrapper: binds the Hilt [RadicalViewModel] to the stateless [RadicalScreen]. */
@Composable
fun RadicalRoute(
    onOpenKanji: (String) -> Unit,
    onBack: () -> Unit,
    viewModel: RadicalViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsState()
    RadicalScreen(
        state = state,
        onToggleRadical = viewModel::toggle,
        onOpenKanji = onOpenKanji,
        onBack = onBack,
    )
}

/**
 * Radical-search screen (D2.6). A stroke-grouped grid of radicals; tapping radicals builds an
 * intersection filter and the matched kanji appear below the divider, each tappable to open the
 * kanji detail. Stateless so it can be Compose-tested without Hilt. Greying-out impossible
 * radicals is deferred to CH.11.
 */
@Composable
fun RadicalScreen(
    state: RadicalUiState,
    onToggleRadical: (String) -> Unit,
    onOpenKanji: (String) -> Unit,
    onBack: () -> Unit,
) {
    Column(Modifier.fillMaxSize()) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp),
        ) {
            ButtonMMD(onClick = onBack) { TextMMD("Back") }
        }

        Column(
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp),
        ) {
            state.byStroke.forEach { (strokes, radicals) ->
                Spacer(Modifier.height(8.dp))
                Text("$strokes 画", fontSize = 13.sp, fontWeight = FontWeight.Bold)
                radicals.chunked(8).forEach { row ->
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        row.forEach { r ->
                            Glyph(
                                glyph = r,
                                selected = r in state.selected,
                                onClick = { onToggleRadical(r) },
                            )
                        }
                    }
                }
            }

            Spacer(Modifier.height(12.dp))
            Divider()
            Spacer(Modifier.height(12.dp))
            Text("Matches (${state.matched.size})", fontSize = 13.sp, fontWeight = FontWeight.Bold)
            state.matched.take(60).chunked(8).forEach { row ->
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    row.forEach { k ->
                        Glyph(glyph = k, selected = false, onClick = { onOpenKanji(k) })
                    }
                }
            }
            Spacer(Modifier.height(16.dp))
        }
    }
}

/**
 * A single tappable CJK glyph. Selected radicals are bracketed + bold so the choice reads on an
 * e-ink panel without relying on color or ripple.
 */
@Composable
private fun Glyph(glyph: String, selected: Boolean, onClick: () -> Unit) {
    Text(
        text = if (selected) "[$glyph]" else glyph,
        fontFamily = NotoSansJp,
        fontSize = 22.sp,
        fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal,
        modifier = Modifier
            .clickable { onClick() }
            .padding(vertical = 4.dp),
    )
}
