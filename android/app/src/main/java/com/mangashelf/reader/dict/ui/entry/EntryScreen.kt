package com.mangashelf.reader.dict.ui.entry

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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Divider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.mangashelf.dict.data.model.EntryDetail
import com.mangashelf.dict.data.model.KanjiRow
import com.mangashelf.dict.data.model.Sentence
import com.mangashelf.dict.data.model.SenseGroup
import com.mangashelf.dict.data.model.TermHit
import com.mangashelf.dict.engine.ConjugationTable
import com.mangashelf.reader.dict.ui.render.StructuredContentText
import com.mangashelf.reader.ui.theme.NotoSansJp
import com.mudita.mmd.components.buttons.ButtonMMD
import com.mudita.mmd.components.text.TextMMD

/** Route wrapper: binds the Hilt [EntryViewModel] to the stateless [EntryScreen] (D2.3). */
@Composable
fun EntryRoute(
    onOpenKanji: (String) -> Unit,
    onBack: () -> Unit,
    viewModel: EntryViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsState()
    EntryScreen(state, onOpenKanji, onBack)
}

/**
 * D2.3 entry-detail screen: headword/reading header, numbered senses, kanji-in-word strip
 * (tap → kanji detail), examples, compounds, and an expandable forward-conjugation table.
 * Stateless so it can be Compose-tested without Hilt. `onAddCard` is the F.8 mining stub.
 */
@Composable
fun EntryScreen(
    state: EntryUiState,
    onOpenKanji: (String) -> Unit,
    onBack: () -> Unit,
    onAddCard: () -> Unit = {},
) {
    Column(Modifier.fillMaxSize()) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            ButtonMMD(onClick = onBack) { TextMMD("Back") }
        }
        when (state) {
            EntryUiState.Loading -> Centered { TextMMD("Loading…") }
            EntryUiState.NotFound -> Centered { TextMMD("Not found") }
            is EntryUiState.Loaded -> LoadedContent(
                detail = state.detail,
                conjugation = state.conjugation,
                onOpenKanji = onOpenKanji,
                onAddCard = onAddCard,
            )
        }
    }
}

@Composable
private fun LoadedContent(
    detail: EntryDetail,
    conjugation: ConjugationTable?,
    onOpenKanji: (String) -> Unit,
    onAddCard: () -> Unit,
) {
    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 16.dp),
    ) {
        HeaderSection(detail)

        Spacer(Modifier.height(12.dp))
        SensesSection(detail.senses)

        if (detail.kanjiInWord.isNotEmpty()) {
            Spacer(Modifier.height(16.dp))
            KanjiStrip(detail.kanjiInWord, onOpenKanji)
        }

        if (detail.examples.isNotEmpty()) {
            Spacer(Modifier.height(16.dp))
            ExamplesSection(detail.examples)
        }

        if (detail.compounds.isNotEmpty()) {
            Spacer(Modifier.height(16.dp))
            CompoundsSection(detail.compounds)
        }

        if (conjugation != null) {
            Spacer(Modifier.height(16.dp))
            ConjugationSection(conjugation)
        }

        Spacer(Modifier.height(24.dp))
        ButtonMMD(onClick = onAddCard) { TextMMD("Add card") }
        Spacer(Modifier.height(16.dp))
    }
}

@Composable
private fun HeaderSection(detail: EntryDetail) {
    Text(
        text = detail.headword,
        fontFamily = NotoSansJp,
        fontSize = 30.sp,
        fontWeight = FontWeight.Bold,
    )
    if (detail.reading.isNotBlank()) {
        Text(
            text = " 【${detail.reading}】",
            fontFamily = NotoSansJp,
            fontSize = 18.sp,
        )
    }
}

@Composable
private fun SensesSection(senses: List<SenseGroup>) {
    Column {
        senses.forEachIndexed { i, sense ->
            Row(Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
                Text("${i + 1}.", fontWeight = FontWeight.Bold)
                Spacer(Modifier.width(8.dp))
                Column(Modifier.weight(1f)) {
                    val pos = sense.definitionTags
                        .filter { it != "*" && it.isNotBlank() }
                        .joinToString(" · ")
                    if (pos.isNotBlank()) {
                        Text(pos, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }
                    StructuredContentText(nodes = sense.glossary, fontFamily = NotoSansJp)
                }
            }
        }
    }
}

@Composable
private fun KanjiStrip(kanji: List<KanjiRow>, onOpenKanji: (String) -> Unit) {
    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        kanji.forEach { k ->
            Text(
                text = k.character,
                fontFamily = NotoSansJp,
                fontSize = 32.sp,
                modifier = Modifier.clickable { onOpenKanji(k.character) },
            )
        }
    }
}

@Composable
private fun ExamplesSection(examples: List<Sentence>) {
    Column {
        examples.take(5).forEach { ex ->
            Text(ex.jp, fontFamily = NotoSansJp)
            ex.en?.let { en -> Text(en, fontSize = 13.sp) }
            Spacer(Modifier.height(6.dp))
        }
    }
}

@Composable
private fun CompoundsSection(compounds: List<TermHit>) {
    Column {
        compounds.take(10).forEach { hit ->
            Text(hit.record.expression, fontFamily = NotoSansJp)
        }
    }
}

@Composable
private fun ConjugationSection(table: ConjugationTable) {
    var expanded by remember { mutableStateOf(false) }
    ButtonMMD(onClick = { expanded = !expanded }) { TextMMD("Conjugations") }
    if (expanded) {
        Spacer(Modifier.height(8.dp))
        Column {
            table.groups.forEach { group ->
                Text(group.name, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                group.forms.forEach { form ->
                    Row(Modifier.fillMaxWidth().padding(vertical = 2.dp)) {
                        Text(form.label, fontSize = 13.sp, modifier = Modifier.weight(1f))
                        Text(form.form, fontFamily = NotoSansJp, modifier = Modifier.weight(1f))
                    }
                }
                Spacer(Modifier.height(6.dp))
                Divider()
                Spacer(Modifier.height(6.dp))
            }
        }
    }
}

@Composable
private fun Centered(content: @Composable () -> Unit) {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { content() }
}
