package com.mangashelf.reader.dict.search

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.mangashelf.dict.data.model.GlossText
import com.mangashelf.dict.data.model.TermHit
import com.mangashelf.dict.data.model.TermRow
import com.mangashelf.reader.dict.ui.search.SearchScreen
import com.mangashelf.reader.dict.ui.search.SearchUiState
import com.mangashelf.reader.ui.theme.MangaShelfTheme
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/** D2.2 UI: the stateless search screen, no Hilt/engine. */
@RunWith(AndroidJUnit4::class)
class SearchScreenTest {

    @get:Rule
    val compose = createComposeRule()

    private val hit = TermHit(
        record = TermRow(
            id = 1,
            dict = "jitendex",
            expression = "食べる",
            reading = "たべる",
            expressionReverse = "るべ食",
            definitionTags = emptyList(),
            rules = emptyList(),
            score = 0,
            glossary = listOf(GlossText("to eat")),
            sequence = 1358280,
            termTags = emptyList(),
        ),
        source = "食べる",
        reasons = emptyList(),
        dictTitle = "Jitendex",
    )

    private val state = SearchUiState(query = "taberu", results = listOf(hit))

    @Test
    fun showsHeadwordAndNavButtons() {
        compose.setContent {
            MangaShelfTheme {
                SearchScreen(
                    state = state,
                    onQueryChange = {},
                    onOpenEntry = {},
                    onOpenKanji = {},
                    onKana = {},
                    onRadical = {},
                    onBack = {},
                )
            }
        }
        compose.onNodeWithText("食べる").assertIsDisplayed()
        compose.onNodeWithText("Kana").assertIsDisplayed()
        compose.onNodeWithText("Radicals").assertIsDisplayed()
    }

    @Test
    fun tappingResultOpensEntryBySequence() {
        var opened = -1
        compose.setContent {
            MangaShelfTheme {
                SearchScreen(
                    state = state,
                    onQueryChange = {},
                    onOpenEntry = { opened = it },
                    onOpenKanji = {},
                    onKana = {},
                    onRadical = {},
                    onBack = {},
                )
            }
        }
        compose.onNodeWithText("食べる").performClick()
        assertEquals(1358280, opened)
    }
}
