package com.mangashelf.reader.data.reader

/** A sub-region of a page in source pixels (own type so the grid math is JVM-testable). */
data class CellRect(val left: Int, val top: Int, val right: Int, val bottom: Int) {
    fun width(): Int = right - left
    fun height(): Int = bottom - top
}

/**
 * 3×3 zoom anchor grid. Each cell is one third of the page expanded by [overlap] on each shared
 * edge, then clamped to the page — giving ~3× magnification with ~15% overlap so text straddling a
 * cell boundary stays readable in both neighbours. `position = row*3 + col` (0 = top-left, 4 =
 * centre, 8 = bottom-right). Pure (returns [CellRect]); the UI converts to android Rect for decode.
 */
object ZoomGrid {

    fun cellRect(position: Int, pageWidth: Int, pageHeight: Int, overlap: Float = 0.15f): CellRect {
        val col = position % 3
        val row = position / 3
        val stepX = pageWidth / 3
        val stepY = pageHeight / 3
        val expandX = (stepX * overlap / 2f).toInt()
        val expandY = (stepY * overlap / 2f).toInt()

        val left = (col * stepX - expandX).coerceAtLeast(0)
        val top = (row * stepY - expandY).coerceAtLeast(0)
        val right = ((col + 1) * stepX + expandX).coerceAtMost(pageWidth)
        val bottom = ((row + 1) * stepY + expandY).coerceAtMost(pageHeight)
        return CellRect(left, top, right, bottom)
    }
}
