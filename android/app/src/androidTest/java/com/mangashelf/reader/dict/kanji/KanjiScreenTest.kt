package com.mangashelf.reader.dict.kanji

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.mangashelf.dict.data.model.KanjiDetail
import com.mangashelf.dict.data.model.TermHit
import com.mangashelf.dict.data.model.TermRow
import com.mangashelf.reader.dict.ui.kanji.KanjiScreen
import com.mangashelf.reader.dict.ui.kanji.KanjiUiState
import com.mangashelf.reader.ui.theme.MangaShelfTheme
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/** D2.4 UI: the stateless kanji-detail screen, no Hilt/backend. */
@RunWith(AndroidJUnit4::class)
class KanjiScreenTest {

    @get:Rule
    val compose = createComposeRule()

    private val detail = KanjiDetail(
        character = "食",
        onyomi = listOf("ショク"),
        kunyomi = listOf("た.べる"),
        meanings = listOf("eat", "food"),
        tags = emptyList(),
        stats = mapOf("strokes" to "9"),
        kanjiVgAssetPath = "kanjivg/09/098df.svg",
        compounds = listOf(
            TermHit(
                TermRow(1L, "jitendex", "食事", "しょくじ", "事食", emptyList(), emptyList(), 0, emptyList(), 1310720, emptyList()),
                "食事",
                emptyList(),
                "Jitendex",
                null,
                null,
            ),
        ),
    )

    @Test
    fun kanjiDetail_showsGlyphMeaningAndCompound_andCompoundOpensEntry() {
        var opened = -1
        compose.setContent {
            MangaShelfTheme {
                KanjiScreen(
                    state = KanjiUiState.Loaded(detail),
                    onOpenEntry = { opened = it },
                    onBack = {},
                )
            }
        }

        compose.onNodeWithText("食").assertIsDisplayed()
        // "eat" is rendered inside "eat, food" — match as a substring.
        compose.onNodeWithText("eat", substring = true).assertExists()

        compose.onNodeWithText("食事").performClick()
        assertEquals(1310720, opened)
    }
}
