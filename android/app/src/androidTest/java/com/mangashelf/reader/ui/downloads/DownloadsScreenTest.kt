package com.mangashelf.reader.ui.downloads

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import com.mangashelf.reader.data.local.entities.DownloadState
import com.mangashelf.reader.ui.theme.MangaShelfTheme
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test

/** CH.8/5.2: active + queued + failed render together with live %, and cancel/retry fire per row. */
class DownloadsScreenTest {

    @get:Rule
    val rule = createComposeRule()

    private val rows = listOf(
        DownloadRowUi(mangaId = 1, volumeNumber = 1, title = "Berserk", state = DownloadState.DOWNLOADING, percent = 45),
        DownloadRowUi(mangaId = 1, volumeNumber = 2, title = "Berserk", state = DownloadState.QUEUED, percent = -1),
        DownloadRowUi(mangaId = 2, volumeNumber = 1, title = "Vinland Saga", state = DownloadState.FAILED, percent = -1),
    )

    @Test
    fun rendersAllStates_andCancelRetryFire() {
        var cancelled: Pair<Int, Int>? = null
        var retried: Pair<Int, Int>? = null
        rule.setContent {
            MangaShelfTheme {
                DownloadsScreen(
                    rows = rows,
                    onCancel = { m, v -> cancelled = m to v },
                    onRetry = { m, v -> retried = m to v },
                    onBack = {},
                )
            }
        }

        rule.onNodeWithText("Berserk · Vol 1").assertIsDisplayed()
        rule.onNodeWithText("45%").assertIsDisplayed()
        rule.onNodeWithText("Vinland Saga · Vol 1").assertIsDisplayed()

        // The failed row offers Retry; active + queued rows each offer Cancel.
        rule.onNodeWithText("Retry").performClick()
        assertEquals(2 to 1, retried)
        // First Cancel belongs to the first (DOWNLOADING vol 1) row.
        rule.onAllNodesWithText("Cancel")[0].performClick()
        assertEquals(1 to 1, cancelled)
    }

    @Test
    fun emptyState_rendersWhenNoDownloads() {
        rule.setContent {
            MangaShelfTheme {
                DownloadsScreen(rows = emptyList(), onCancel = { _, _ -> }, onRetry = { _, _ -> }, onBack = {})
            }
        }
        rule.onNodeWithText("No downloads yet.").assertIsDisplayed()
    }
}
