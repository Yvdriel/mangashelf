package com.mangashelf.reader.data.reader

/** Result of a quick tap in the reader. */
enum class TapZone { Prev, Next, ToggleBar }

/** Page navigation direction (shared by tap zones and hardware volume keys). */
enum class PageDirection { Prev, Next }

/**
 * Maps a quick tap to a reader action. A thin band along the TOP edge, restricted to the horizontal
 * CENTRE, toggles the MMD top bar; everywhere else the LEFT half is previous-page and the RIGHT half
 * is next-page. Pure (Float coords) so it is unit-testable without Compose.
 */
object ReaderGestures {

    private const val TOP_STRIP_FRACTION = 0.12f
    private const val CENTER_BAND_START = 0.30f
    private const val CENTER_BAND_END = 0.70f

    fun zoneFor(x: Float, y: Float, w: Float, h: Float): TapZone {
        val inTopStrip = y <= h * TOP_STRIP_FRACTION
        val inCenterBand = x in (w * CENTER_BAND_START)..(w * CENTER_BAND_END)
        return when {
            inTopStrip && inCenterBand -> TapZone.ToggleBar
            x < w / 2f -> TapZone.Prev
            else -> TapZone.Next
        }
    }
}
