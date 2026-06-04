package com.mangashelf.reader.data.reader

import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * 4.2: tap-zone disambiguation kept pure (Float coords, no Compose) so the LEFT=prev / RIGHT=next /
 * thin TOP-CENTER=toggle-bar layout is unit-testable without a device. Screen is 800×480 landscape.
 */
class ReaderGesturesTest {

    private val w = 800f
    private val h = 480f

    @Test
    fun leftHalf_isPrev() {
        assertEquals(TapZone.Prev, ReaderGestures.zoneFor(x = 0.20f * w, y = 0.5f * h, w = w, h = h))
    }

    @Test
    fun rightHalf_isNext() {
        assertEquals(TapZone.Next, ReaderGestures.zoneFor(x = 0.80f * w, y = 0.5f * h, w = w, h = h))
    }

    @Test
    fun topCenterStrip_togglesBar() {
        assertEquals(TapZone.ToggleBar, ReaderGestures.zoneFor(x = 0.5f * w, y = 0.04f * h, w = w, h = h))
    }

    @Test
    fun topLeftCorner_isPrev_notToggle() {
        // High up but outside the central band -> still a page tap, not the bar toggle.
        assertEquals(TapZone.Prev, ReaderGestures.zoneFor(x = 0.05f * w, y = 0.04f * h, w = w, h = h))
    }

    @Test
    fun topRightCorner_isNext_notToggle() {
        assertEquals(TapZone.Next, ReaderGestures.zoneFor(x = 0.95f * w, y = 0.04f * h, w = w, h = h))
    }

    @Test
    fun centerVertical_neverTogglesBar() {
        // The toggle strip is a thin top band only; a center tap is page nav.
        assertEquals(TapZone.Next, ReaderGestures.zoneFor(x = 0.5f * w, y = 0.5f * h, w = w, h = h))
    }
}
