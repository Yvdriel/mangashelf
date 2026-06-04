package com.mangashelf.reader.ocr

import com.mangashelf.reader.data.reader.CellRect
import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * O.2: the box→screen scale math (the alignment correctness of the overlay) + the source-pixel crop
 * rect for the native image grab. `ContentScale.Fit` letterboxes a centered image inside the
 * container; OCR boxes live in source-image pixels and must map onto that fitted rect. Pure (own
 * float types, no Compose/Android) so it unit-tests without a device.
 */
class OverlayScaleTest {

    private val eps = 0.5f

    @Test
    fun fit_tallImageInPortrait_letterboxesVertically() {
        // img 1488×2266 in a 480×800 container: width-bound (scale 480/1488), centered vertically.
        val f = OverlayScale.fittedRect(containerW = 480f, containerH = 800f, imgW = 1488, imgH = 2266)
        assertEquals(480f / 1488f, f.scale, 0.0001f)
        assertEquals(0f, f.offsetX, eps)
        assertEquals((800f - 2266f * (480f / 1488f)) / 2f, f.offsetY, eps)
    }

    @Test
    fun fit_squareImageInWide_letterboxesHorizontally() {
        val f = OverlayScale.fittedRect(containerW = 800f, containerH = 480f, imgW = 1000, imgH = 1000)
        assertEquals(0.48f, f.scale, 0.0001f)
        assertEquals(160f, f.offsetX, eps) // (800 - 480) / 2
        assertEquals(0f, f.offsetY, eps)
    }

    @Test
    fun blockToScreen_appliesScaleThenOffset() {
        val f = FittedImage(offsetX = 10f, offsetY = 20f, scale = 0.5f)
        val r = OverlayScale.blockToScreen(box = listOf(100, 200, 300, 400), fitted = f)
        assertEquals(60f, r.left, eps)   // 10 + 100*0.5
        assertEquals(120f, r.top, eps)   // 20 + 200*0.5
        assertEquals(160f, r.right, eps) // 10 + 300*0.5
        assertEquals(220f, r.bottom, eps) // 20 + 400*0.5
    }

    @Test
    fun cropRectSource_scalesMokuroBoxToActualPagePixels_withPadding() {
        // mokuro ran on 1000×2000; CBZ page is 2000×4000 (2×). pad 10 source px.
        val c: CellRect = OverlayScale.cropRectSource(
            box = listOf(100, 200, 340, 900),
            paddingPx = 10,
            imgW = 1000, imgH = 2000,
            pageW = 2000, pageH = 4000,
        )
        assertEquals(190, c.left)    // 100*2 - 10
        assertEquals(390, c.top)     // 200*2 - 10
        assertEquals(690, c.right)   // 340*2 + 10
        assertEquals(1810, c.bottom) // 900*2 + 10
    }

    @Test
    fun cropRectSource_clampsToPageBounds() {
        val c = OverlayScale.cropRectSource(
            box = listOf(0, 0, 1000, 2000),
            paddingPx = 50,
            imgW = 1000, imgH = 2000,
            pageW = 1000, pageH = 2000,
        )
        assertEquals(0, c.left)     // -50 clamped to 0
        assertEquals(0, c.top)
        assertEquals(1000, c.right) // +50 clamped to pageW
        assertEquals(2000, c.bottom)
    }
}
