package com.mangashelf.reader.sync

import org.junit.Assert.assertEquals
import org.junit.Test

/** Bytes→percent for the download row / [androidx.work.WorkInfo] progress. -1 = unknown length. */
class DownloadProgressTest {

    @Test
    fun zeroOfKnownTotal_isZero() = assertEquals(0, DownloadProgress.percent(0, 100))

    @Test
    fun halfway_isFifty() = assertEquals(50, DownloadProgress.percent(50, 100))

    @Test
    fun complete_isHundred() = assertEquals(100, DownloadProgress.percent(100, 100))

    @Test
    fun unknownTotal_isIndeterminate() = assertEquals(-1, DownloadProgress.percent(10, 0))

    @Test
    fun overshoot_clampsToHundred() = assertEquals(100, DownloadProgress.percent(200, 100))

    @Test
    fun largeValues_useLongMath_noOverflow() =
        assertEquals(50, DownloadProgress.percent(3_000_000_000L, 6_000_000_000L))
}
