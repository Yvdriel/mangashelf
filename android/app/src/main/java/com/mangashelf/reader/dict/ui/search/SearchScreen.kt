package com.mangashelf.reader.dict.ui.search

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.mangashelf.dict.data.model.TermHit
import com.mangashelf.reader.dict.ui.render.StructuredContentText
import com.mangashelf.reader.ui.theme.NotoSansJp
import com.mudita.mmd.components.buttons.ButtonMMD
import com.mudita.mmd.components.text.TextMMD

/** Route wrapper: binds the Hilt [SearchViewModel] to the stateless [SearchScreen]. */
@Composable
fun SearchRoute(
    onOpenEntry: (Int) -> Unit,
    onOpenKanji: (String) -> Unit,
    onKana: () -> Unit,
    onRadical: () -> Unit,
    onBack: () -> Unit,
    viewModel: SearchViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsState()
    SearchScreen(
        state = state,
        onQueryChange = viewModel::onQueryChange,
        onOpenEntry = onOpenEntry,
        onOpenKanji = onOpenKanji,
        onKana = onKana,
        onRadical = onRadical,
        onBack = onBack,
    )
}

/**
 * D2.2 unified search screen. A single box routes romaji / kana / kanji / `食*` wildcard / English
 * to [SearchViewModel]; results are headword + reading + a one-line gloss. Stateless so it can be
 * Compose-tested without Hilt (mirror of the flashcards [com.mangashelf.reader.flashcards.ui.review.ReviewScreen]).
 */
@Composable
fun SearchScreen(
    state: SearchUiState,
    onQueryChange: (String) -> Unit,
    onOpenEntry: (Int) -> Unit,
    onOpenKanji: (String) -> Unit,
    onKana: () -> Unit,
    onRadical: () -> Unit,
    onBack: () -> Unit,
) {
    Column(Modifier.fillMaxSize()) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            ButtonMMD(onClick = onBack) { TextMMD("Back") }
            ButtonMMD(onClick = onKana) { TextMMD("Kana") }
            ButtonMMD(onClick = onRadical) { TextMMD("Radicals") }
        }

        OutlinedTextField(
            value = state.query,
            onValueChange = onQueryChange,
            label = { Text("Search 漢字 / kana / romaji / English / 食*") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp),
        )

        if (state.results.isEmpty() && state.query.isNotBlank() && !state.loading) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                TextMMD("Nothing found")
            }
        } else {
            LazyColumn(Modifier.fillMaxSize()) {
                items(state.results, key = { it.record.id }) { hit ->
                    SearchResultItem(hit = hit, onClick = { onOpenEntry(hit.record.sequence) })
                }
            }
        }
    }
}

/** One result row: headword + reading (+ deinflection note) + a one-line native gloss. */
@Composable
private fun SearchResultItem(hit: TermHit, onClick: () -> Unit) {
    Column(
        Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 8.dp),
    ) {
        Text(text = hit.record.expression, fontFamily = NotoSansJp, fontSize = 22.sp)

        val readingLine = buildString {
            append(hit.record.reading)
            if (hit.reasons.isNotEmpty()) {
                if (isNotEmpty()) append(' ')
                append("(${hit.reasons.joinToString(" ")})")
            }
        }
        if (readingLine.isNotBlank()) {
            Text(text = readingLine, fontFamily = NotoSansJp, fontSize = 15.sp)
        }

        if (hit.record.glossary.isNotEmpty()) {
            StructuredContentText(nodes = hit.record.glossary, fontFamily = NotoSansJp)
        }
    }
}
