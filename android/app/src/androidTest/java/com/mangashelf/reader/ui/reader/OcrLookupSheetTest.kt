package com.mangashelf.reader.ui.reader

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import com.mangashelf.reader.ocr.scanResultOf
import com.mangashelf.reader.ocr.termHit
import com.mangashelf.reader.ui.theme.MangaShelfTheme
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test

/**
 * O.3 (kompakt28): the lookup popup (MMD modal bottom sheet) shows the selectable OCR text and a
 * "Create card" action that fires the mining callback.
 */
class OcrLookupSheetTest {

    @get:Rule
    val rule = createComposeRule()

    @Test
    fun showsSentence_andCreateCardAction() {
        rule.setContent {
            MangaShelfTheme {
                OcrLookupSheet(popup = OcrPopupState(sentence = "食べた"), onCreateCard = { _, _ -> }, onDismiss = {})
            }
        }
        rule.onNodeWithText("食べた").assertIsDisplayed()
        rule.onNodeWithTag(OCR_CREATE_CARD_TAG).assertIsDisplayed()
    }

    @Test
    fun createCard_firesCallback() {
        var created = 0
        rule.setContent {
            MangaShelfTheme {
                OcrLookupSheet(popup = OcrPopupState(sentence = "猫"), onCreateCard = { _, _ -> created++ }, onDismiss = {})
            }
        }
        rule.onNodeWithTag(OCR_CREATE_CARD_TAG).performClick()
        rule.waitForIdle()
        assertEquals(1, created)
    }

    @Test
    fun rendersResolvedDictionaryEntry_withDeinflectionReasonChain() {
        val popup = OcrPopupState(
            sentence = "食べた",
            results = listOf(scanResultOf("食べた", listOf(termHit("食べる", "たべる", "to eat", reasons = listOf("past"))))),
            loading = false,
        )
        rule.setContent {
            MangaShelfTheme { OcrLookupSheet(popup = popup, onCreateCard = { _, _ -> }, onDismiss = {}) }
        }
        rule.onNodeWithText("食べる 【たべる】").assertIsDisplayed() // resolved dictionary form
        rule.onNodeWithText("← past").assertIsDisplayed()           // deinflection reason chain
    }
}
