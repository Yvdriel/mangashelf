package com.mangashelf.reader.ui.reader

import com.mangashelf.reader.data.reader.PageDirection
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Bridges hardware volume-key presses (caught by [com.mangashelf.reader.MainActivity.onKeyDown]) to
 * the active reader. [readerActive] lets the Activity consume volume keys only while reading (so the
 * system volume UI still works everywhere else); the reader sets it via its lifecycle.
 */
@Singleton
class ReaderKeyBus @Inject constructor() {

    private val _keys = MutableSharedFlow<PageDirection>(extraBufferCapacity = 8)
    val keys: SharedFlow<PageDirection> = _keys

    @Volatile
    var readerActive: Boolean = false

    fun emit(direction: PageDirection) {
        _keys.tryEmit(direction)
    }
}
