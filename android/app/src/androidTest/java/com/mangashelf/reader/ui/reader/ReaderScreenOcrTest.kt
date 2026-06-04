package com.mangashelf.reader.ui.reader

import android.graphics.Bitmap
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.doubleClick
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performTouchInput
import com.mangashelf.reader.data.reader.ZoomState
import com.mangashelf.reader.ocr.MokuroBlock
import com.mangashelf.reader.ocr.MokuroPage
import com.mangashelf.reader.ocr.ocrBlockTag
import com.mangashelf.reader.ui.theme.MangaShelfTheme
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test

/**
 * O.2 acceptance (kompakt28): the OCR overlay is shown over the page in FullView (and a block
 * double-tap fires the selection), is **hidden while zoomed** (so the gesture is inert and e-ink
 * ghosting is cut), and respects the reader-settings show/hide toggle.
 */
class ReaderScreenOcrTest {

    @get:Rule
    val rule = createComposeRule()

    private fun bmp() = Bitmap.createBitmap(300, 600, Bitmap.Config.ARGB_8888)

    private val ocrPage = MokuroPage(
        imgWidth = 300, imgHeight = 600, imgPath = "001.jpg",
        blocks = listOf(MokuroBlock(box = listOf(10, 10, 200, 200), vertical = true, fontSize = 20.0, lines = listOf("食べた"))),
    )

    private fun setScreen(
        zoom: ZoomState = ZoomState.FullView,
        overlayVisible: Boolean = true,
        onSelect: (MokuroBlock, Int) -> Unit = { _, _ -> },
    ) {
        rule.setContent {
            MangaShelfTheme {
                ReaderScreen(
                    state = ReaderUiState(
                        pageIndex = 0, pageCount = 1, bitmap = bmp(), topBarVisible = false,
                        zoom = zoom, regionBitmap = if (zoom is ZoomState.Zoom) bmp() else null,
                        ocrPage = ocrPage, overlayVisible = overlayVisible,
                    ),
                    onPrev = {}, onNext = {}, onToggleBar = {}, onEnterZoom = {},
                    onOcrBlockSelected = onSelect, onBack = {},
                )
            }
        }
    }

    @Test
    fun fullView_showsOverlay_andDoubleTapFiresSelection() {
        var idx = -1
        setScreen(onSelect = { _, i -> idx = i })
        rule.onNodeWithTag(ocrBlockTag(0)).assertIsDisplayed()
        rule.onNodeWithTag(ocrBlockTag(0)).performTouchInput { doubleClick() }
        rule.waitForIdle()
        assertEquals(0, idx)
    }

    @Test
    fun zoomed_overlayIsAbsent_soSelectionIsInert() {
        setScreen(zoom = ZoomState.Zoom(4))
        rule.onNodeWithTag(ocrBlockTag(0)).assertDoesNotExist()
    }

    @Test
    fun overlayToggledOff_hidesBlocks() {
        setScreen(overlayVisible = false)
        rule.onNodeWithTag(ocrBlockTag(0)).assertDoesNotExist()
    }
}
