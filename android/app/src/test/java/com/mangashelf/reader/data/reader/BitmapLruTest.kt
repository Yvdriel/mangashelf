package com.mangashelf.reader.data.reader

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * 4.1: the 3-bitmap LRU's eviction/recycle bookkeeping, kept pure (generic value, injected evictor)
 * so the recycle contract — the heap bound — is unit-testable without a device. `PageSource` wires
 * the value to `Bitmap` and the evictor to `Bitmap::recycle`.
 */
class BitmapLruTest {

    @Test
    fun holdsUpToMaxSize_withoutEvicting() {
        val evicted = mutableListOf<String>()
        val lru = BitmapLru<String>(maxSize = 3) { evicted += it }
        lru.put(0, "a"); lru.put(1, "b"); lru.put(2, "c")
        assertEquals(3, lru.size())
        assertTrue(evicted.isEmpty())
    }

    @Test
    fun insertingPastMax_evictsLeastRecentlyUsed_andRecycles() {
        val evicted = mutableListOf<String>()
        val lru = BitmapLru<String>(maxSize = 3) { evicted += it }
        lru.put(0, "a"); lru.put(1, "b"); lru.put(2, "c")
        lru.put(3, "d") // exceeds 3 -> evict eldest (key 0 / "a")
        assertEquals(3, lru.size())
        assertEquals(listOf("a"), evicted)
        assertNull(lru.get(0))
    }

    @Test
    fun get_marksRecentlyUsed_soItSurvivesEviction() {
        val evicted = mutableListOf<String>()
        val lru = BitmapLru<String>(maxSize = 3) { evicted += it }
        lru.put(0, "a"); lru.put(1, "b"); lru.put(2, "c")
        lru.get(0)        // touch "a" -> now "b" is eldest
        lru.put(3, "d")   // evict "b"
        assertEquals(listOf("b"), evicted)
        assertEquals("a", lru.get(0))
    }

    @Test
    fun clear_evictsEverything() {
        val evicted = mutableListOf<String>()
        val lru = BitmapLru<String>(maxSize = 3) { evicted += it }
        lru.put(0, "a"); lru.put(1, "b")
        lru.clear()
        assertEquals(0, lru.size())
        assertEquals(setOf("a", "b"), evicted.toSet())
    }
}
