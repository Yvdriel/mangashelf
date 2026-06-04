package com.mangashelf.reader.data.reader

import java.io.File

/**
 * Single source of truth for a downloaded volume's on-device location. The reader
 * ([com.mangashelf.reader.di.ReaderModule]) and the download worker (CH.8/5.1) both resolve paths
 * here so they can never drift. Volume numbers are NOT zero-padded (`v1.cbz`, `v10.cbz`) — this is
 * the literal path CH.7 shipped and pushed fixtures into. The `.mokuro` OCR sidecar (O.1) sits beside
 * the CBZ under the same per-manga folder.
 */
object ArchivePaths {

    /** Root of all downloaded archives — deleted wholesale by Clear Cache / server change (6.2). */
    fun root(filesDir: File): File = File(filesDir, "archives")

    fun dir(filesDir: File, mangaId: Int): File = File(root(filesDir), "$mangaId")

    fun cbz(filesDir: File, mangaId: Int, volumeNumber: Int): File =
        File(dir(filesDir, mangaId), "v$volumeNumber.cbz")

    fun mokuro(filesDir: File, mangaId: Int, volumeNumber: Int): File =
        File(dir(filesDir, mangaId), "v$volumeNumber.mokuro")
}
