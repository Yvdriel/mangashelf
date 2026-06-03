package com.mangashelf.reader.flashcards

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.mangashelf.reader.flashcards.data.AnkiBackend
import com.mangashelf.reader.flashcards.data.CollectionRepository
import com.mangashelf.reader.flashcards.data.model.Rating
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File

/** F.4: answering a card is undoable, and undo returns the card to the queue. */
@RunWith(AndroidJUnit4::class)
class UndoTest {

    private lateinit var dir: File
    private lateinit var repo: CollectionRepository

    @Before
    fun setup() {
        val ctx = InstrumentationRegistry.getInstrumentation().targetContext
        dir = File(ctx.filesDir, "test_undo_${System.nanoTime()}")
        dir.deleteRecursively()
        repo = CollectionRepository(AnkiBackend(), dir)
    }

    @After
    fun teardown() {
        repo.close()
        dir.deleteRecursively()
    }

    @Test
    fun answer_thenUndo_returnsCardToQueue() = runBlocking {
        val deckId = repo.bootstrap()
        repo.addMiningNote(deckId, "テスト", null, "", null, null, emptyList())

        val before = repo.nextCard(deckId)
        assertNotNull(before)

        // Answering Good sends the new card into learning, so it is no longer immediately due.
        repo.answer(before!!.cardId, Rating.GOOD)
        assertTrue("answering must be undoable", repo.undoLabel().isNotBlank())

        // Undo reverts the answer: the card becomes a due new card again.
        repo.undo()
        val after = repo.nextCard(deckId)
        assertNotNull("the card returns to the queue after undo", after)
        assertEquals("the same card is due again", before.cardId, after!!.cardId)
    }
}
