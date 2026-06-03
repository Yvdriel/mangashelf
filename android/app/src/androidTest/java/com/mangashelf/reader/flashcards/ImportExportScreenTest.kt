package com.mangashelf.reader.flashcards

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.mangashelf.reader.flashcards.ui.importexport.ImportExportScreen
import com.mangashelf.reader.flashcards.ui.importexport.IoStatus
import com.mangashelf.reader.ui.theme.MangaShelfTheme
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/** F.7 UI: the stateless import/export screen, no Hilt/backend. */
@RunWith(AndroidJUnit4::class)
class ImportExportScreenTest {

    @get:Rule
    val compose = createComposeRule()

    @Test
    fun idle_showsActionsAndReadyStatus() {
        compose.setContent {
            MangaShelfTheme {
                ImportExportScreen(
                    status = IoStatus.Idle,
                    onExportColpkg = {},
                    onExportApkg = {},
                    onPickImport = {},
                    onBack = {},
                )
            }
        }
        compose.onNodeWithText("Export .colpkg (full backup)").assertExists()
        compose.onNodeWithText("Import…").assertExists()
        compose.onNodeWithText("Ready").assertIsDisplayed()
    }
}
