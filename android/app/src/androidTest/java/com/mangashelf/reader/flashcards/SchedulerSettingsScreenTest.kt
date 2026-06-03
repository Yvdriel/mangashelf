package com.mangashelf.reader.flashcards

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.mangashelf.reader.flashcards.data.model.SchedulerSettings
import com.mangashelf.reader.flashcards.ui.settings.SchedulerSettingsScreen
import com.mangashelf.reader.ui.theme.MangaShelfTheme
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/** F.5 UI: the stateless scheduler-settings screen, no Hilt/backend. */
@RunWith(AndroidJUnit4::class)
class SchedulerSettingsScreenTest {

    @get:Rule
    val compose = createComposeRule()

    @Test
    fun renders_labelsAndSave() {
        compose.setContent {
            MangaShelfTheme {
                SchedulerSettingsScreen(
                    settings = SchedulerSettings.DEFAULT,
                    onRollover = {},
                    onNewPerDay = {},
                    onReviewsPerDay = {},
                    onFsrs = {},
                    onRetention = {},
                    onSave = {},
                    onBack = {},
                )
            }
        }
        compose.onNodeWithText("FSRS enabled").assertExists()
        compose.onNodeWithText("Save").assertIsDisplayed()
    }
}
