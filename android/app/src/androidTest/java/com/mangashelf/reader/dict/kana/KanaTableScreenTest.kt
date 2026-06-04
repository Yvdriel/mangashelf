package com.mangashelf.reader.dict.kana

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onFirst
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.mangashelf.reader.dict.ui.kana.KanaTableScreen
import com.mangashelf.reader.ui.theme.MangaShelfTheme
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/** D2.5 UI: the authored kana reference table, no engine/Hilt. */
@RunWith(AndroidJUnit4::class)
class KanaTableScreenTest {

    @get:Rule
    val compose = createComposeRule()

    @Test
    fun defaultsToHiragana() {
        compose.setContent {
            MangaShelfTheme { KanaTableScreen(onBack = {}) }
        }
        compose.onNodeWithText("あ").assertIsDisplayed()
    }

    @Test
    fun katakanaToggleSwapsGlyphs() {
        compose.setContent {
            MangaShelfTheme { KanaTableScreen(onBack = {}) }
        }
        // Hiragana is the default script.
        compose.onNodeWithText("あ").assertIsDisplayed()

        // "Katakana" matches both the toggle button and the active-script label, so click the
        // first match (the toggle button).
        compose.onAllNodesWithText("Katakana").onFirst().performClick()

        compose.onNodeWithText("ア").assertIsDisplayed()
    }
}
