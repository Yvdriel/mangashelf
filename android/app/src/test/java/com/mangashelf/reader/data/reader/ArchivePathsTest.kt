package com.mangashelf.reader.data.reader

import org.junit.Assert.assertEquals
import org.junit.Test
import java.io.File

/**
 * The download worker (CH.8/5.1) and the reader ([com.mangashelf.reader.di.ReaderModule]) MUST agree
 * on byte-identical paths or a downloaded volume is invisible to the reader. Volume numbers are NOT
 * zero-padded — `v1.cbz`, `v10.cbz` — matching the literal path CH.7 shipped.
 */
class ArchivePathsTest {

    private val filesDir = File("/data/user/0/com.mangashelf.reader/files")

    @Test
    fun cbz_matchesReaderPath_noZeroPadding() {
        assertEquals(
            File(filesDir, "archives/7/v3.cbz"),
            ArchivePaths.cbz(filesDir, mangaId = 7, volumeNumber = 3),
        )
    }

    @Test
    fun mokuro_sitsBesideTheCbz() {
        assertEquals(
            File(filesDir, "archives/7/v3.mokuro"),
            ArchivePaths.mokuro(filesDir, mangaId = 7, volumeNumber = 3),
        )
    }

    @Test
    fun doubleDigitVolume_isStillNotPadded() {
        assertEquals(
            File(filesDir, "archives/12/v10.cbz"),
            ArchivePaths.cbz(filesDir, mangaId = 12, volumeNumber = 10),
        )
    }

    @Test
    fun dir_isThePerMangaArchiveFolder() {
        assertEquals(File(filesDir, "archives/7"), ArchivePaths.dir(filesDir, mangaId = 7))
    }
}
