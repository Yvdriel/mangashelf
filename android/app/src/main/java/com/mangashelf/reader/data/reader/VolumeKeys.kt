package com.mangashelf.reader.data.reader

import android.view.KeyEvent

/**
 * Hardware volume keys are the Kompakt's only physical navigation (no D-pad / page buttons): DOWN
 * advances, UP goes back. Returns null for any other key so MainActivity lets it fall through.
 */
object VolumeKeys {

    fun directionFor(keyCode: Int): PageDirection? = when (keyCode) {
        KeyEvent.KEYCODE_VOLUME_DOWN -> PageDirection.Next
        KeyEvent.KEYCODE_VOLUME_UP -> PageDirection.Prev
        else -> null
    }
}
