package com.mangashelf.reader.dict.entry

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.mangashelf.dict.data.model.EntryDetail
import com.mangashelf.dict.data.model.GlossText
import com.mangashelf.dict.data.model.KanjiRow
import com.mangashelf.dict.data.model.SenseGroup
import com.mangashelf.dict.data.model.Sentence
import com.mangashelf.reader.dict.ui.entry.EntryScreen
import com.mangashelf.reader.dict.ui.entry.EntryUiState
import com.mangashelf.reader.ui.theme.MangaShelfTheme
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/** D2.3 UI: the stateless entry-detail screen, no Hilt/backend. */
@RunWith(AndroidJUnit4::class)
class EntryScreenTest {

    @get:Rule
    val compose = createComposeRule()

    private val state = EntryUiState.Loaded(
        detail = EntryDetail(
            headword = "食べる",
            reading = "たべる",
            altForms = emptyList(),
            senses = listOf(SenseGroup(listOf("v1"), listOf(GlossText("to eat")))),
            kanjiInWord = listOf(
                KanjiRow(1, "kanjidic", "食", emptyList(), emptyList(), emptyList(), listOf("eat"), emptyMap()),
            ),
            examples = listOf(Sentence("彼は食べる", "He eats")),
            compounds = emptyList(),
            furigana = emptyList(),
            sequence = 1358280,
        ),
        conjugation = null,
    )

    @Test
    fun showsHeadwordSenseAndKanjiTap() {
        var tappedKanji: String? = null
        compose.setContent {
            MangaShelfTheme {
                EntryScreen(
                    state = state,
                    onOpenKanji = { tappedKanji = it },
                    onBack = {},
                )
            }
        }

        compose.onNodeWithText("食べる").assertIsDisplayed()
        compose.onNodeWithText("to eat").assertIsDisplayed()

        compose.onNodeWithText("食").performClick()
        assertEquals("食", tappedKanji)
    }
}
