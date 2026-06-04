package com.mangashelf.reader.data.reader

import org.junit.Assert.assertEquals
import org.junit.Test

/** 4.3: the FullView↔Zoom(0..8) state machine and clamped swipe-to-move. Pure JVM. */
class ZoomStateTest {

    @Test
    fun enter_startsAtCenter() {
        assertEquals(ZoomState.Zoom(4), ZoomState.FullView.enter())
    }

    @Test
    fun exit_returnsToFullView() {
        assertEquals(ZoomState.FullView, ZoomState.Zoom(4).exit())
    }

    @Test
    fun swipe_movesOneCell_inSwipedDirection() {
        val center = ZoomState.Zoom(4)
        assertEquals(ZoomState.Zoom(3), center.onSwipe(SwipeDirection.Left))
        assertEquals(ZoomState.Zoom(5), center.onSwipe(SwipeDirection.Right))
        assertEquals(ZoomState.Zoom(1), center.onSwipe(SwipeDirection.Up))
        assertEquals(ZoomState.Zoom(7), center.onSwipe(SwipeDirection.Down))
    }

    @Test
    fun swipe_clampsAtEdges_noWrap() {
        assertEquals(ZoomState.Zoom(0), ZoomState.Zoom(0).onSwipe(SwipeDirection.Left))
        assertEquals(ZoomState.Zoom(0), ZoomState.Zoom(0).onSwipe(SwipeDirection.Up))
        assertEquals(ZoomState.Zoom(8), ZoomState.Zoom(8).onSwipe(SwipeDirection.Right))
        assertEquals(ZoomState.Zoom(8), ZoomState.Zoom(8).onSwipe(SwipeDirection.Down))
    }

    @Test
    fun fourSwipes_fromCenter_reachAllCorners() {
        val center = ZoomState.Zoom(4)
        // top-left
        assertEquals(ZoomState.Zoom(0), center.onSwipe(SwipeDirection.Up).onSwipe(SwipeDirection.Left))
        // bottom-right
        assertEquals(ZoomState.Zoom(8), center.onSwipe(SwipeDirection.Down).onSwipe(SwipeDirection.Right))
    }

    @Test
    fun dominantDirection_picksLargerAxis_aboveThreshold() {
        assertEquals(SwipeDirection.Left, SwipeDirection.dominant(dx = -120f, dy = 20f, threshold = 40f))
        assertEquals(SwipeDirection.Right, SwipeDirection.dominant(dx = 120f, dy = -20f, threshold = 40f))
        assertEquals(SwipeDirection.Up, SwipeDirection.dominant(dx = 10f, dy = -120f, threshold = 40f))
        assertEquals(SwipeDirection.Down, SwipeDirection.dominant(dx = 10f, dy = 120f, threshold = 40f))
    }

    @Test
    fun dominantDirection_belowThreshold_isNull() {
        assertEquals(null, SwipeDirection.dominant(dx = 10f, dy = 10f, threshold = 40f))
    }
}
