package com.mangashelf.reader.data.reader

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * 4.3: the 3×3 zoom anchor grid (~3× magnification, ~15% overlap so boundary text isn't split),
 * clamped to the page. Pure (own CellRect, no android.graphics.Rect) so it is JVM-testable.
 * Page 1200×1800 → step 400×600, overlap 0.15 → expand ±30 / ±45.
 */
class ZoomGridTest {

    private val w = 1200
    private val h = 1800

    @Test
    fun ninePositions_mapToGridCells() {
        // position = row*3 + col; 0 = top-left, 4 = centre, 8 = bottom-right.
        val c0 = ZoomGrid.cellRect(0, w, h)
        assertEquals(0, c0.left)
        assertEquals(0, c0.top)

        val c8 = ZoomGrid.cellRect(8, w, h)
        assertEquals(1200, c8.right)
        assertEquals(1800, c8.bottom)
    }

    @Test
    fun centerCell_isExpandedByOverlap() {
        val c4 = ZoomGrid.cellRect(4, w, h)
        assertEquals(370, c4.left)
        assertEquals(555, c4.top)
        assertEquals(830, c4.right)
        assertEquals(1245, c4.bottom)
    }

    @Test
    fun adjacentCells_overlap_soBoundaryTextIsNotSplit() {
        val c0 = ZoomGrid.cellRect(0, w, h)
        val c1 = ZoomGrid.cellRect(1, w, h)
        assertTrue("cells must overlap horizontally", c0.right > c1.left)
    }

    @Test
    fun magnification_isRoughly3x() {
        val mag = w.toFloat() / ZoomGrid.cellRect(4, w, h).width()
        assertTrue("≈3× expected, was $mag", mag in 2.4f..3.0f)
    }

    @Test
    fun edgeCells_areClampedToPage() {
        val c2 = ZoomGrid.cellRect(2, w, h) // top-right
        assertEquals(1200, c2.right)
        assertEquals(0, c2.top)
    }
}
