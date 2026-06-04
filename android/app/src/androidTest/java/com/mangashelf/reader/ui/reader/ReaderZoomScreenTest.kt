package com.mangashelf.reader.ui.reader

import android.graphics.Bitmap
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.test.click
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.swipeDown
import androidx.compose.ui.test.swipeLeft
import androidx.compose.ui.test.swipeRight
import androidx.compose.ui.test.swipeUp
import com.mangashelf.reader.data.reader.SwipeDirection
import com.mangashelf.reader.data.reader.ZoomState
import com.mangashelf.reader.ui.theme.MangaShelfTheme
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Rule
import org.junit.Test

/** 4.3: while zoomed, directional swipes move the cell and page-turn taps are inert. */
class ReaderZoomScreenTest {

    @get:Rule
    val rule = createComposeRule()

    private fun region() = Bitmap.createBitmap(160, 160, Bitmap.Config.ARGB_8888)

    private var lastSwipe: SwipeDirection? = null
    private var nextCount = 0

    private fun setZoomed() {
        lastSwipe = null
        nextCount = 0
        rule.setContent {
            MangaShelfTheme {
                ReaderScreen(
                    state = ReaderUiState(
                        pageIndex = 2,
                        pageCount = 10,
                        bitmap = region(),
                        topBarVisible = false,
                        zoom = ZoomState.Zoom(4),
                        regionBitmap = region(),
                    ),
                    onPrev = {},
                    onNext = { nextCount++ },
                    onToggleBar = {},
                    onEnterZoom = {},
                    onOcrBlockDoubleTap = {},
                    onBack = {},
                    onZoomSwipe = { lastSwipe = it },
                    onExitZoom = {},
                )
            }
        }
    }

    @Test
    fun swipeLeft_movesCellLeft() {
        setZoomed()
        rule.onNodeWithTag(READER_SURFACE_TAG).performTouchInput { swipeLeft() }
        rule.waitForIdle()
        assertEquals(SwipeDirection.Left, lastSwipe)
    }

    @Test
    fun swipeRight_movesCellRight() {
        setZoomed()
        rule.onNodeWithTag(READER_SURFACE_TAG).performTouchInput { swipeRight() }
        rule.waitForIdle()
        assertEquals(SwipeDirection.Right, lastSwipe)
    }

    @Test
    fun swipeUp_movesCellUp() {
        setZoomed()
        rule.onNodeWithTag(READER_SURFACE_TAG).performTouchInput { swipeUp() }
        rule.waitForIdle()
        assertEquals(SwipeDirection.Up, lastSwipe)
    }

    @Test
    fun swipeDown_movesCellDown() {
        setZoomed()
        rule.onNodeWithTag(READER_SURFACE_TAG).performTouchInput { swipeDown() }
        rule.waitForIdle()
        assertEquals(SwipeDirection.Down, lastSwipe)
    }

    @Test
    fun tapWhileZoomed_doesNotTurnPage() {
        setZoomed()
        rule.onNodeWithTag(READER_SURFACE_TAG).performTouchInput { click(Offset(width * 0.8f, height * 0.5f)) }
        rule.waitForIdle()
        assertEquals(0, nextCount)
        assertNull("a tap is not a swipe", lastSwipe)
    }
}
