package com.mangashelf.reader.flashcards

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.mangashelf.reader.flashcards.data.AnkiBackend
import com.mangashelf.reader.flashcards.data.CollectionRepository
import com.mangashelf.reader.flashcards.data.model.Rating
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File

/** F.6 acceptance (instrumented): reviewsByDay reflects today's reviews from the revlog. */
@RunWith(AndroidJUnit4::class)
class HeatmapDataTest {

    private lateinit var dir: File
    private lateinit var repo: CollectionRepository

    @Before
    fun setup() {
        val ctx = InstrumentationRegistry.getInstrumentation().targetContext
        dir = File(ctx.filesDir, "test_heatmap_${System.nanoTime()}")
        dir.deleteRecursively()
        repo = CollectionRepository(AnkiBackend(), dir)
    }

    @After
    fun teardown() {
        repo.close()
        dir.deleteRecursively()
    }

    @Test
    fun reviewsByDay_countsTodaysReviews() = runBlocking {
        val deckId = repo.bootstrap()
        val noteId = repo.addMiningNote(deckId, "テスト", null, "", null, null, emptyList())
        val cardId = repo.cardsOfNote(noteId).first()
        repo.answer(cardId, Rating.GOOD) // one review today

        val byDay = repo.reviewsByDay(30)
        val today = byDay[0] ?: 0
        assertTrue("today's review count should be >= 1, got map=$byDay", today >= 1)
    }
}
