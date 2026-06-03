package com.mangashelf.reader.flashcards

import com.mangashelf.reader.flashcards.ui.stats.bucket
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** F.6: the pure review-count → intensity-bucket mapping (no Compose/Android). */
class HeatmapBucketTest {

    @Test
    fun mapsRepresentativeCountsToBuckets() {
        assertEquals(0, bucket(0))
        assertEquals(1, bucket(2))
        assertEquals(2, bucket(5))
        assertEquals(3, bucket(15))
        assertEquals(4, bucket(40))
    }

    @Test
    fun bucketsAtExactThresholdBoundaries() {
        assertEquals(0, bucket(0))
        assertEquals(1, bucket(1))
        assertEquals(1, bucket(3))
        assertEquals(2, bucket(4))
        assertEquals(2, bucket(9))
        assertEquals(3, bucket(10))
        assertEquals(3, bucket(24))
        assertEquals(4, bucket(25))
    }

    @Test
    fun isMonotonicNonDecreasingAcrossThresholds() {
        var previous = bucket(0)
        for (count in 1..100) {
            val current = bucket(count)
            assertTrue(
                "bucket($count)=$current should be >= bucket(${count - 1})=$previous",
                current >= previous,
            )
            previous = current
        }
    }

    @Test
    fun bucketsAreBoundedToZeroThroughFour() {
        for (count in 0..1000) {
            val b = bucket(count)
            assertTrue("bucket($count)=$b out of range", b in 0..4)
        }
    }
}
