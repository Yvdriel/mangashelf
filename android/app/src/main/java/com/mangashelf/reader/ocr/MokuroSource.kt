package com.mangashelf.reader.ocr

/**
 * Loads the parsed mokuro document for a (manga, volume), or null when no `.mokuro` sidecar exists
 * (not yet OCR'd) or it can't be parsed. Abstracted so the reader ViewModel is testable without a
 * device; the production binding ([com.mangashelf.reader.di.ReaderModule]) reads the local sidecar
 * at `filesDir/archives/<mangaId>/v<volumeNumber>.mokuro` that CH.8/O.1 downloads beside the CBZ.
 */
fun interface MokuroSourceFactory {
    fun load(mangaId: Int, volumeNumber: Int): MokuroDoc?
}
