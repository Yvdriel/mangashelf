package com.mangashelf.reader.flashcards

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.mangashelf.reader.flashcards.data.AnkiBackend
import com.mangashelf.reader.flashcards.data.CollectionRepository
import com.mangashelf.reader.flashcards.data.model.Rating
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File

/**
 * F.7 TDD anchor — `.colpkg` round-trip with revlog history intact.
 *
 * Build a collection with a real review-log entry, export a `.colpkg`, import it into a *fresh*
 * collection, and assert the card's review-log count survives (colpkg is a full-collection,
 * history-preserving replace) and the deck/notes come across. (Re-opening the export in desktop
 * Anki is the manual device pass.)
 */
@RunWith(AndroidJUnit4::class)
class ColpkgRoundTripTest {

    @Test
    fun colpkgExport_thenImportIntoFreshCollection_preservesRevlogHistory() = runBlocking {
        val ctx = InstrumentationRegistry.getInstrumentation().targetContext
        val stamp = System.nanoTime()
        val srcDir = File(ctx.filesDir, "rt_src_$stamp")
        val dstDir = File(ctx.filesDir, "rt_dst_$stamp")
        val exportFile = File(ctx.cacheDir, "rt_$stamp.colpkg")
        srcDir.deleteRecursively(); dstDir.deleteRecursively(); exportFile.delete()

        // --- Source: a card with review history ------------------------------------
        val src = CollectionRepository(AnkiBackend(), srcDir)
        val deckId = src.bootstrap()
        val noteId = src.addMiningNote(deckId, "テスト", null, "", null, null, emptyList())
        val cardId = src.cardsOfNote(noteId).first()
        src.answer(cardId, Rating.GOOD) // one revlog entry

        val before = src.cardRevlogCount(cardId)
        assertTrue("source must have review history, got $before", before >= 1)

        src.exportColpkg(exportFile.absolutePath)
        src.close()
        assertTrue("colpkg must be written", exportFile.exists() && exportFile.length() > 0)

        // --- Fresh target: import + verify history survived ------------------------
        val dst = CollectionRepository(AnkiBackend(), dstDir)
        dst.bootstrap()
        dst.importColpkg(exportFile.absolutePath)

        assertEquals(
            "revlog history must survive the colpkg round-trip",
            before,
            dst.cardRevlogCount(cardId),
        )
        dst.refreshDecks()
        assertTrue(
            "imported collection must contain the Mining deck",
            dst.decks().value.any { it.name == CollectionRepository.MINING_DECK },
        )
        dst.close()
    }
}
