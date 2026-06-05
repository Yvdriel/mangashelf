package com.mangashelf.reader.ui.nav

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import com.mangashelf.reader.ui.theme.MangaShelfTheme
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test

/**
 * D3.3 (kompakt28): the 3-section bottom nav renders Reader / Dictionary / Flashcards and routes a
 * tap to the right section. (The full NavHost-backed switch is exercised by the end-to-end gate.)
 */
class ShellBottomBarTest {

    @get:Rule
    val rule = createComposeRule()

    @Test
    fun rendersThreeSections() {
        rule.setContent { MangaShelfTheme { ShellBottomBar(selected = ShellSection.READER, onSelect = {}) } }
        rule.onNodeWithTag("nav-reader").assertIsDisplayed()
        rule.onNodeWithTag("nav-dictionary").assertIsDisplayed()
        rule.onNodeWithTag("nav-flashcards").assertIsDisplayed()
    }

    @Test
    fun tappingDictionary_selectsDictionarySection() {
        var picked: ShellSection? = null
        rule.setContent { MangaShelfTheme { ShellBottomBar(selected = ShellSection.READER, onSelect = { picked = it }) } }
        rule.onNodeWithTag("nav-dictionary").performClick()
        rule.waitForIdle()
        assertEquals(ShellSection.DICTIONARY, picked)
    }

    @Test
    fun tappingFlashcards_selectsFlashcardsSection() {
        var picked: ShellSection? = null
        rule.setContent { MangaShelfTheme { ShellBottomBar(selected = ShellSection.READER, onSelect = { picked = it }) } }
        rule.onNodeWithTag("nav-flashcards").performClick()
        rule.waitForIdle()
        assertEquals(ShellSection.FLASHCARDS, picked)
    }
}
