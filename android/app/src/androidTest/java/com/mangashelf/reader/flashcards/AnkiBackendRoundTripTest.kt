package com.mangashelf.reader.flashcards

import android.util.Log
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.mangashelf.reader.flashcards.data.AnkiBackend
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File

/**
 * F.1 viability gate (instrumented, arm64 emulator).
 *
 * Proves end-to-end:
 *  1. The Anki backend AAR resolves and its arm64-v8a librsdroid.so loads at runtime
 *     (System.loadLibrary("rsdroid"); the production AAR ships no auto-loader).
 *  2. A collection opens (and is created on disk) at a real Android filesDir path.
 *  3. Proto round-trips work in BOTH directions:
 *       a. read:  getDeckIdByName("Default") returns the always-present Default deck (id 1);
 *       b. write: addDeck(Deck{name=...}) creates a deck, then getDeckNames lists it back.
 *  4. The collection closes and the SAME file reopens with the written deck still present —
 *     proving persistence and no lock / handle leak.
 *
 * NOTE on getDeckNames of a *fresh* collection: Anki 25.02 returns an empty list for a brand
 * new collection even with skipEmptyDefault=false (the Default deck id is 1 but it is not
 * surfaced by getDeckNames until a deck is actually created). The round-trip is proven via
 * getDeckIdByName==1 and the added-deck appearing in the listing, NOT via the empty fresh list.
 */
@RunWith(AndroidJUnit4::class)
class AnkiBackendRoundTripTest {

    private val tag = "F1Spike"

    @Test
    fun opensCollection_roundTripsDeckNames_andReopens() {
        val ctx = InstrumentationRegistry.getInstrumentation().targetContext
        val colFile = File(ctx.filesDir, "f1_spike.anki2")
        // Start from a clean slate so we exercise creation + the auto-made Default deck.
        if (colFile.exists()) require(colFile.delete()) { "could not delete stale ${colFile.path}" }
        File(ctx.filesDir, "f1_spike.media").deleteRecursively()

        val backend = AnkiBackend()
        val deckName = "F1-Spike-Deck"

        // --- Pass 1: open, round-trip (read + write), close --------------------------
        backend.open(colFile.absolutePath)
        assertTrue("collection should be open after open()", backend.isOpen)
        assertTrue("collection file should exist on disk", colFile.exists())

        // Read round-trip: the Default deck always resolves to id 1.
        val defaultId = backend.defaultDeckId()
        Log.i(tag, "getDeckIdByName(Default) = $defaultId")
        assertEquals("Default deck id must be 1 (proto read round-trip)", 1L, defaultId)

        // Write round-trip: create a deck, then read it back via getDeckNames.
        val newId = backend.createDeck(deckName)
        Log.i(tag, "addDeck($deckName) -> id $newId")
        assertTrue("addDeck must return a valid deck id", newId > 0L)

        val names = backend.deckNames().map { it.name }
        Log.i(tag, "getDeckNames -> $names")
        assertTrue(
            "deck list must contain the just-created deck, got $names",
            names.any { it == deckName }
        )

        backend.close()
        assertFalse("backend should report closed after close()", backend.isOpen)

        // --- Pass 2: REOPEN the same file, prove the write persisted -----------------
        val reopened = AnkiBackend()
        reopened.open(colFile.absolutePath)
        assertTrue("reopening the same collection file must succeed", reopened.isOpen)
        val reopenedNames = reopened.deckNames().map { it.name }
        Log.i(tag, "after reopen getDeckNames -> $reopenedNames")
        assertTrue(
            "reopened collection must still contain the persisted deck, got $reopenedNames",
            reopenedNames.any { it == deckName }
        )
        reopened.close()
        assertFalse("reopened backend should report closed after close()", reopened.isOpen)
    }
}
