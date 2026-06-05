package com.mangashelf.reader.ocr

import androidx.compose.foundation.layout.size
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.doubleClick
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.unit.dp
import com.mangashelf.reader.ui.theme.MangaShelfTheme
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test

/**
 * O.2 (kompakt28): the native OCR overlay renders one tappable node per block scaled onto the
 * displayed page, and a **double-tap** fires the block selection with the original block index.
 * Long-press is intentionally NOT wired (reserved for zoom) — only double-tap selects.
 */
class OcrOverlayTest {

    @get:Rule
    val rule = createComposeRule()

    private val page = MokuroPage(
        imgWidth = 300,
        imgHeight = 600,
        imgPath = "001.jpg",
        blocks = listOf(
            MokuroBlock(box = listOf(10, 10, 140, 120), vertical = true, fontSize = 20.0, lines = listOf("食べた")),
            MokuroBlock(box = listOf(160, 400, 290, 560), vertical = false, fontSize = 18.0, lines = listOf("YO")),
        ),
    )

    @Test
    fun rendersOneTappableNodePerBlock() {
        rule.setContent {
            MangaShelfTheme {
                OcrOverlay(page = page, modifier = Modifier.size(300.dp, 600.dp), onBlockSelect = { _, _ -> })
            }
        }
        rule.onNodeWithTag(ocrBlockTag(0)).assertIsDisplayed()
        rule.onNodeWithTag(ocrBlockTag(1)).assertIsDisplayed()
    }

    @Test
    fun doubleTapOnBlock_firesSelectionWithOriginalIndex() {
        var selectedIdx = -1
        var selectedText: String? = null
        rule.setContent {
            MangaShelfTheme {
                OcrOverlay(
                    page = page,
                    modifier = Modifier.size(300.dp, 600.dp),
                    onBlockSelect = { block, idx -> selectedIdx = idx; selectedText = block.lines.firstOrNull() },
                )
            }
        }
        rule.onNodeWithTag(ocrBlockTag(0)).performTouchInput { doubleClick() }
        rule.waitForIdle()
        assertEquals(0, selectedIdx)
        assertEquals("食べた", selectedText)
    }

    @Test
    fun nullCallback_rendersBlocks_butNoGesture() {
        rule.setContent {
            MangaShelfTheme {
                OcrOverlay(page = page, modifier = Modifier.size(300.dp, 600.dp), onBlockSelect = null)
            }
        }
        // Blocks still render (the overlay is just not interactive while zoomed/hidden).
        rule.onNodeWithTag(ocrBlockTag(0)).assertIsDisplayed()
    }
}
