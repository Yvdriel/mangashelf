package com.mangashelf.reader.ui.settings

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import com.mangashelf.reader.ui.theme.MangaShelfTheme
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

/** CH.8/6.2: Sync/Clear fire directly; changing the server is destructive so it's gated by a confirm. */
class SettingsScreenTest {

    @get:Rule
    val rule = createComposeRule()

    @Test
    fun syncAndClear_fireDirectly() {
        var synced = false
        var cleared = false
        rule.setContent {
            MangaShelfTheme {
                SettingsScreen(
                    serverUrl = "http://10.0.2.2:3000",
                    onSyncNow = { synced = true },
                    onClearCache = { cleared = true },
                    onChangeServer = {},
                    onBack = {},
                )
            }
        }
        rule.onNodeWithText("http://10.0.2.2:3000").assertIsDisplayed()
        rule.onNodeWithText("Sync now").performClick()
        rule.onNodeWithText("Clear cache").performClick()
        assertTrue(synced)
        assertTrue(cleared)
    }

    @Test
    fun changeServer_isGatedByConfirmation() {
        var changed = false
        rule.setContent {
            MangaShelfTheme {
                SettingsScreen(
                    serverUrl = "http://10.0.2.2:3000",
                    onSyncNow = {},
                    onClearCache = {},
                    onChangeServer = { changed = true },
                    onBack = {},
                )
            }
        }
        rule.onNodeWithText("Change server").performClick()
        // Confirmation is shown; the purge has NOT happened yet.
        assertEquals(false, changed)
        rule.onNodeWithText("Erase & change").performClick()
        assertTrue("confirming triggers the purge + re-onboard", changed)
    }
}
