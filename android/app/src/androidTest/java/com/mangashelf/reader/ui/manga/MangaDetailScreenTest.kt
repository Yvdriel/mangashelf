package com.mangashelf.reader.ui.manga

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import com.mangashelf.reader.data.local.MangaWithVolumes
import com.mangashelf.reader.data.local.entities.MangaEntity
import com.mangashelf.reader.data.local.entities.VolumeEntity
import com.mangashelf.reader.ui.theme.MangaShelfTheme
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test

/**
 * 3.4 guard: the detail screen renders its volume rows + pin toggle without a composition crash
 * (an earlier early-`return` in the composable imbalanced Compose's group stack), and the pin
 * button reports the current state to toggle.
 */
class MangaDetailScreenTest {

    @get:Rule
    val rule = createComposeRule()

    private val fixture = MangaWithVolumes(
        manga = MangaEntity(
            id = 1, anilistId = null, title = "Yotsuba to!",
            folderName = "Yotsuba", coverImage = null, totalVolumes = 1, updatedAt = 100,
        ),
        volumes = listOf(
            VolumeEntity(mangaId = 1, volumeNumber = 1, serverVolumeId = 10, folderName = "v01", pageCount = 120),
        ),
    )

    @Test
    fun rendersVolumeRow_andPinReportsCurrentState() {
        var toggled: Pair<Int, Boolean>? = null
        rule.setContent {
            MangaShelfTheme {
                MangaDetailScreen(
                    manga = fixture,
                    onTogglePin = { volumeNumber, pinned -> toggled = volumeNumber to pinned },
                    onRead = {},
                    onBack = {},
                )
            }
        }

        rule.onNodeWithText("Yotsuba to!").assertIsDisplayed()
        rule.onNodeWithText("Vol 1").assertIsDisplayed()
        rule.onNodeWithText("[Available]").assertIsDisplayed()

        rule.onNodeWithText("Pin").performClick()
        assertEquals(1 to false, toggled)
    }
}
