package com.mangashelf.reader.ocr

import com.mangashelf.reader.data.reader.CellRect

/** The on-screen placement of an image drawn with `ContentScale.Fit`: a uniform [scale] from
 *  source-image pixels to container pixels, plus the centering [offsetX]/[offsetY] (letterbox). */
data class FittedImage(val offsetX: Float, val offsetY: Float, val scale: Float)

/** A rectangle in container (on-screen) pixels. */
data class ScreenRect(val left: Float, val top: Float, val right: Float, val bottom: Float) {
    fun width(): Float = right - left
    fun height(): Float = bottom - top
}

/**
 * O.2 box→screen scale math + the source-pixel crop rect for the native image grab. Pure (no
 * Compose/Android) so the alignment correctness is JVM-testable.
 */
object OverlayScale {

    /** The fitted rect of an [imgW]×[imgH] image inside a [containerW]×[containerH] box under Fit. */
    fun fittedRect(containerW: Float, containerH: Float, imgW: Int, imgH: Int): FittedImage {
        if (imgW <= 0 || imgH <= 0) return FittedImage(0f, 0f, 1f)
        val scale = minOf(containerW / imgW, containerH / imgH)
        val drawnW = imgW * scale
        val drawnH = imgH * scale
        return FittedImage(
            offsetX = (containerW - drawnW) / 2f,
            offsetY = (containerH - drawnH) / 2f,
            scale = scale,
        )
    }

    /** Maps a source-pixel OCR [box] (x1,y1,x2,y2) onto its on-screen rect under [fitted]. */
    fun blockToScreen(box: List<Int>, fitted: FittedImage): ScreenRect {
        val (x1, y1, x2, y2) = box
        return ScreenRect(
            left = fitted.offsetX + x1 * fitted.scale,
            top = fitted.offsetY + y1 * fitted.scale,
            right = fitted.offsetX + x2 * fitted.scale,
            bottom = fitted.offsetY + y2 * fitted.scale,
        )
    }

    /**
     * The source-pixel crop rect for `PageSource.decodeRegion`. Mokuro boxes are in the mokuro
     * page's pixels ([imgW]×[imgH]); the decoded CBZ page may be a different size ([pageW]×[pageH]),
     * so scale by the per-axis ratio, pad by [paddingPx], and clamp to the page.
     */
    fun cropRectSource(
        box: List<Int>,
        paddingPx: Int,
        imgW: Int,
        imgH: Int,
        pageW: Int,
        pageH: Int,
    ): CellRect {
        val sx = if (imgW > 0) pageW.toFloat() / imgW else 1f
        val sy = if (imgH > 0) pageH.toFloat() / imgH else 1f
        val left = (box[0] * sx - paddingPx).toInt().coerceIn(0, pageW)
        val top = (box[1] * sy - paddingPx).toInt().coerceIn(0, pageH)
        val right = (box[2] * sx + paddingPx).toInt().coerceIn(0, pageW)
        val bottom = (box[3] * sy + paddingPx).toInt().coerceIn(0, pageH)
        return CellRect(left, top, right, bottom)
    }
}
