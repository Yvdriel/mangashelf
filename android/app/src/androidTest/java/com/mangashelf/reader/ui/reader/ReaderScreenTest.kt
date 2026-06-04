package com.mangashelf.reader.ui.reader

import android.graphics.Bitmap
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.test.click
import androidx.compose.ui.test.doubleClick
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.longClick
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performTouchInput
import com.mangashelf.reader.ui.theme.MangaShelfTheme
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test

/** 4.2: tap-zone / long-press / double-tap gesture wiring of the stateless reader. */
class ReaderScreenTest {

    @get:Rule
    val rule = createComposeRule()

    private fun page() = Bitmap.createBitmap(120, 180, Bitmap.Config.ARGB_8888)

    private class Calls {
        var prev = 0
        var next = 0
        var toggle = 0
        var zoom = 0
        var ocr = 0
    }

    private fun setScreen(topBarVisible: Boolean = false): Calls {
        val calls = Calls()
        rule.setContent {
            MangaShelfTheme {
                ReaderScreen(
                    state = ReaderUiState(pageIndex = 2, pageCount = 10, bitmap = page(), topBarVisible = topBarVisible),
                    onPrev = { calls.prev++ },
                    onNext = { calls.next++ },
                    onToggleBar = { calls.toggle++ },
                    onEnterZoom = { calls.zoom++ },
                    onOcrBlockDoubleTap = { calls.ocr++ },
                    onBack = {},
                )
            }
        }
        return calls
    }

    // detectTapGestures defers onTap past the double-tap timeout (the debounce that stops a
    // double-tap from also flipping); waitUntil advances the clock through it.
    @Test
    fun tapRightHalf_advances() {
        val calls = setScreen()
        rule.onNodeWithTag(READER_SURFACE_TAG).performTouchInput { click(Offset(width * 0.8f, height * 0.5f)) }
        rule.waitUntil { calls.next == 1 }
        assertEquals(0, calls.prev)
    }

    @Test
    fun tapLeftHalf_goesBack() {
        val calls = setScreen()
        rule.onNodeWithTag(READER_SURFACE_TAG).performTouchInput { click(Offset(width * 0.2f, height * 0.5f)) }
        rule.waitUntil { calls.prev == 1 }
        assertEquals(0, calls.next)
    }

    @Test
    fun tapTopCenter_togglesBar() {
        val calls = setScreen()
        rule.onNodeWithTag(READER_SURFACE_TAG).performTouchInput { click(Offset(width * 0.5f, height * 0.03f)) }
        rule.waitUntil { calls.toggle == 1 }
        assertEquals(0, calls.next)
    }

    @Test
    fun longPress_entersZoom() {
        val calls = setScreen()
        rule.onNodeWithTag(READER_SURFACE_TAG).performTouchInput { longClick(Offset(width * 0.5f, height * 0.5f)) }
        rule.waitForIdle()
        assertEquals(1, calls.zoom)
    }

    @Test
    fun doubleTap_firesOcrSeam_withoutFlippingPage() {
        val calls = setScreen()
        rule.onNodeWithTag(READER_SURFACE_TAG).performTouchInput { doubleClick(Offset(width * 0.8f, height * 0.5f)) }
        rule.waitForIdle()
        assertEquals(1, calls.ocr)
        assertEquals("double-tap must not also advance the page", 0, calls.next)
    }
}
