package com.mangashelf.reader.dict.radical

import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.mangashelf.reader.dict.ui.radical.RadicalScreen
import com.mangashelf.reader.dict.ui.radical.RadicalUiState
import com.mangashelf.reader.ui.theme.MangaShelfTheme
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/** D2.6 UI: the stateless radical-search screen, no Hilt/backend. */
@RunWith(AndroidJUnit4::class)
class RadicalScreenTest {

    @get:Rule
    val compose = createComposeRule()

    // 食 is selected → rendered as "[食]"; matches use distinct glyphs (飯/飲) to avoid ambiguity.
    private val state = RadicalUiState(
        byStroke = listOf(2 to listOf("人"), 9 to listOf("食")),
        selected = setOf("食"),
        matched = listOf("飯", "飲"),
    )

    @Test
    fun showsRadicalsAndMatches() {
        compose.setContent {
            MangaShelfTheme {
                RadicalScreen(
                    state = state,
                    onToggleRadical = {},
                    onOpenKanji = {},
                    onBack = {},
                )
            }
        }
        // Unselected radical shown verbatim; selected radical shown bracketed.
        compose.onNodeWithText("人").assertExists()
        compose.onNodeWithText("食", substring = true).assertExists()
        // A matched kanji is shown.
        compose.onNodeWithText("飯").assertExists()
    }

    @Test
    fun clickingMatchedKanjiOpensIt() {
        var opened = ""
        compose.setContent {
            MangaShelfTheme {
                RadicalScreen(
                    state = state,
                    onToggleRadical = {},
                    onOpenKanji = { opened = it },
                    onBack = {},
                )
            }
        }
        compose.onNodeWithText("飯").performClick()
        assertEquals("飯", opened)
    }

    @Test
    fun clickingRadicalTogglesIt() {
        var toggled = ""
        compose.setContent {
            MangaShelfTheme {
                RadicalScreen(
                    state = state,
                    onToggleRadical = { toggled = it },
                    onOpenKanji = {},
                    onBack = {},
                )
            }
        }
        compose.onNodeWithText("人").performClick()
        assertEquals("人", toggled)
    }
}
