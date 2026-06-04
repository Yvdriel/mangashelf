package com.mangashelf.reader.data.reader

import android.view.KeyEvent
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * 4.2: hardware volume keys advance pages (the Kompakt has no D-pad / page buttons). Volume-DOWN =
 * forward, Volume-UP = back. Mapping is pure so MainActivity's onKeyDown stays a thin dispatcher.
 */
class VolumeKeysTest {

    @Test
    fun volumeDown_advances() {
        assertEquals(PageDirection.Next, VolumeKeys.directionFor(KeyEvent.KEYCODE_VOLUME_DOWN))
    }

    @Test
    fun volumeUp_goesBack() {
        assertEquals(PageDirection.Prev, VolumeKeys.directionFor(KeyEvent.KEYCODE_VOLUME_UP))
    }

    @Test
    fun otherKeys_ignored() {
        assertNull(VolumeKeys.directionFor(KeyEvent.KEYCODE_A))
        assertNull(VolumeKeys.directionFor(KeyEvent.KEYCODE_BACK))
    }
}
