package com.mangashelf.reader.data.reader

import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * 4.1: `inSampleSize` math — the heap bound. Largest power-of-2 `s` with `srcW / s >= targetW`,
 * never below 1, never upscaling. Same function sizes a full page (source width vs ~480px display)
 * and a zoom region (region width vs display) so a region bitmap also stays ≈ display-sized.
 */
class SampleSizeTest {

    @Test
    fun largePage_sampledDownToNearDisplayWidth() {
        // 4096px source, 480px display -> /8 = 512px (>=480), /16 would be 256 (<480).
        assertEquals(8, SampleSize.forWidth(srcW = 4096, targetW = 480))
    }

    @Test
    fun sampleSizeIsPowerOfTwo_atBoundary() {
        assertEquals(2, SampleSize.forWidth(srcW = 960, targetW = 480)) // exactly 2x
        assertEquals(2, SampleSize.forWidth(srcW = 961, targetW = 480)) // just over 2x
        assertEquals(1, SampleSize.forWidth(srcW = 959, targetW = 480)) // just under -> 1
    }

    @Test
    fun sourceSmallerThanTarget_neverUpscales() {
        assertEquals(1, SampleSize.forWidth(srcW = 400, targetW = 480))
        assertEquals(1, SampleSize.forWidth(srcW = 480, targetW = 480))
    }

    @Test
    fun degenerateTarget_returnsOne() {
        assertEquals(1, SampleSize.forWidth(srcW = 4096, targetW = 0))
    }

    @Test
    fun region_sampledRelativeToDisplay_keepsRegionNearDisplaySize() {
        // A 1/3-width cell of a 2400px page (~800px) at 480 display -> /1 (800 already < 2x480).
        assertEquals(1, SampleSize.forWidth(srcW = 800, targetW = 480))
        // A 1/3-width cell of a huge 8000px page (~2666px) -> /4 = 666px (>=480), bounded.
        assertEquals(4, SampleSize.forWidth(srcW = 2666, targetW = 480))
    }
}
