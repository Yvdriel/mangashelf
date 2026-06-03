package com.mangashelf.reader.flashcards

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.mangashelf.reader.flashcards.data.AnkiBackend
import com.mangashelf.reader.flashcards.data.CollectionRepository
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File

/**
 * F.8 acceptance (instrumented): [CollectionRepository.addMiningNote] stores a media file and
 * adds a card into the Mining deck.
 */
@RunWith(AndroidJUnit4::class)
class MiningNoteTest {

    private lateinit var dir: File
    private lateinit var repo: CollectionRepository

    @Before
    fun setup() {
        val ctx = InstrumentationRegistry.getInstrumentation().targetContext
        dir = File(ctx.filesDir, "test_mining_${System.nanoTime()}")
        dir.deleteRecursively()
        repo = CollectionRepository(AnkiBackend(), dir)
    }

    @After
    fun teardown() {
        repo.close()
        dir.deleteRecursively()
    }

    @Test
    fun addMiningNote_createsCardInMiningDeck_andStoresMedia() = runBlocking {
        val deckId = repo.bootstrap()

        val noteId = repo.addMiningNote(
            deckId = deckId,
            sentence = "これは\nテスト",
            imageBytes = "fake-jpeg-bytes".toByteArray(),
            imageFilename = "shelf-test.jpg",
            definitionHtml = "<b>definition</b>",
            source = "Yotsuba Vol 1 p5",
            tags = listOf("mangashelf", "One_Piece"),
        )
        assertTrue("note id must be positive", noteId > 0L)

        repo.refreshDecks()
        val mining = repo.decks().value.first { it.id == deckId }
        assertEquals("adding one note must queue one new card", 1, mining.newCount)

        val media = File(dir, "collection.media").listFiles().orEmpty().toList()
        assertTrue(
            "a media file must be stored, got $media",
            media.any { it.isFile && it.length() > 0 },
        )
    }
}
