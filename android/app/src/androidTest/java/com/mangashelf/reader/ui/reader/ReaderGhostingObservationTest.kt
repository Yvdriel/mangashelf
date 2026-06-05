package com.mangashelf.reader.ui.reader

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.click
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performTouchInput
import androidx.test.platform.app.InstrumentationRegistry
import com.mangashelf.reader.ui.theme.MangaShelfTheme
import org.junit.Rule
import org.junit.Test
import java.io.File

/**
 * Not an assertion — captures a real before/after page-turn pair to characterise e-ink ghosting on
 * the (LCD) emulator. The reader does a discrete full repaint with no animation; on LCD each frame
 * is clean (ghosting is unverifiable here — that needs hardware, CH.11). Screenshots are written to
 * externalCacheDir for `adb pull`.
 */
class ReaderGhostingObservationTest {

    @get:Rule
    val rule = createComposeRule()

    private fun labelledPage(label: String, bg: Int): Bitmap {
        val bmp = Bitmap.createBitmap(480, 720, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bmp)
        canvas.drawColor(bg)
        val paint = Paint().apply { color = Color.BLACK; textSize = 80f; isAntiAlias = true }
        canvas.drawText(label, 60f, 360f, paint)
        return bmp
    }

    @Test
    fun capturePageTurn_beforeAndAfter() {
        val pages = listOf(labelledPage("PAGE 1", Color.WHITE), labelledPage("PAGE 2", Color.rgb(230, 230, 230)))
        val observedIndex = intArrayOf(0)
        rule.setContent {
            MangaShelfTheme {
                var index by remember { mutableIntStateOf(0) }
                ReaderScreen(
                    state = ReaderUiState(pageIndex = index, pageCount = 2, bitmap = pages[index], topBarVisible = false),
                    onPrev = { if (index > 0) index-- },
                    onNext = { if (index < 1) { index++; observedIndex[0] = index } },
                    onToggleBar = {},
                    onEnterZoom = {},
                    onOcrBlockSelected = { _, _ -> },
                    onBack = {},
                )
            }
        }
        val dir = InstrumentationRegistry.getInstrumentation().targetContext.filesDir

        rule.onNodeWithTag(READER_SURFACE_TAG).captureToImage().asAndroidBitmap()
            .let { save(it, File(dir, "ghosting-before.png")) }

        rule.onNodeWithTag(READER_SURFACE_TAG).performTouchInput { click(Offset(width * 0.85f, height * 0.5f)) }
        rule.waitUntil { observedIndex[0] == 1 }
        rule.waitForIdle()

        rule.onNodeWithTag(READER_SURFACE_TAG).captureToImage().asAndroidBitmap()
            .let { save(it, File(dir, "ghosting-after.png")) }
    }

    private fun save(bitmap: Bitmap, file: File) {
        file.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
    }
}
