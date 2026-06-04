package com.mangashelf.reader.data.reader

/**
 * Creates a [PageSource] for a (manga, volume). Abstracted so the reader ViewModel is testable with
 * a fixture CBZ; the production binding (CH.7 [com.mangashelf.reader.di.ReaderModule]) resolves the
 * local archive path `filesDir/archives/<mangaId>/v<volumeNumber>.cbz` that CH.8/5.1 downloads into.
 */
fun interface PageSourceFactory {
    fun create(mangaId: Int, volumeNumber: Int): PageSource
}
