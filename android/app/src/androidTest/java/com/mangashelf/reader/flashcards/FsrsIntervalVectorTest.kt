package com.mangashelf.reader.flashcards

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import anki.scheduler.SchedulingState
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
 * F.3 TDD anchor — FSRS interval test-vector vs desktop Anki.
 *
 * With FSRS on at desired-retention 0.90, answering **Easy** on a brand-new card graduates it to a
 * review interval governed by the FSRS-5 initial-stability parameter w[3] ≈ 15.69 days. Legacy
 * SM-2 would give a 4-day easy-graduate interval, so an interval in the ~16-day band is a concrete,
 * FSRS-specific vector (tolerant of interval fuzz). We also assert the four buttons are monotonic
 * (Again ≤ Hard ≤ Good < Easy) and that the backend reports four non-blank interval labels — the
 * exact strings the review screen shows.
 */
@RunWith(AndroidJUnit4::class)
class FsrsIntervalVectorTest {

    private lateinit var dir: File
    private lateinit var repo: CollectionRepository

    @Before
    fun setup() {
        val ctx = InstrumentationRegistry.getInstrumentation().targetContext
        dir = File(ctx.filesDir, "test_fsrs_${System.nanoTime()}")
        dir.deleteRecursively()
        repo = CollectionRepository(AnkiBackend(), dir)
    }

    @After
    fun teardown() {
        repo.close()
        dir.deleteRecursively()
    }

    @Test
    fun freshCard_easyGraduate_matchesFsrs5InitialStability_andButtonsAreMonotonic() = runBlocking {
        val deckId = repo.bootstrap()
        repo.addMiningNote(
            deckId = deckId,
            sentence = "テスト",
            imageBytes = null,
            imageFilename = "",
            definitionHtml = null,
            source = null,
            tags = emptyList(),
        )

        repo.onBackend { b ->
            b.setCurrentDeck(deckId)
            val queued = b.getQueuedCards(1, false)
            assertEquals("exactly one new card due", 1, queued.cardsCount)
            val states = queued.getCards(0).states

            // The four interval labels the review screen renders on its buttons.
            val labels = b.describeNextStates(states)
            assertEquals("four button labels", 4, labels.size)
            assertTrue("labels must be non-blank, got $labels", labels.all { it.isNotBlank() })

            // Monotonic schedules across the four buttons.
            val again = intervalSecs(states.again)
            val hard = intervalSecs(states.hard)
            val good = intervalSecs(states.good)
            val easy = intervalSecs(states.easy)
            assertTrue("again<=hard<=good ($again,$hard,$good)", again <= hard && hard <= good)
            assertTrue("good<easy ($good,$easy)", good < easy)

            // FSRS-5 vector: Easy graduates a new card to a review interval ~ w[3]=15.69 days.
            assertTrue("easy must graduate to a review state", states.easy.normal.hasReview())
            val easyDays = states.easy.normal.review.scheduledDays
            assertTrue(
                "FSRS easy-graduate interval must be ~16d (w[3]); SM-2 would be 4d. Got $easyDays",
                easyDays in 12..20,
            )
        }
    }

    private fun intervalSecs(s: SchedulingState): Long {
        val n = s.normal
        return when {
            n.hasReview() -> n.review.scheduledDays.toLong() * 86_400L
            n.hasLearning() -> n.learning.scheduledSecs.toLong()
            else -> 0L
        }
    }
}
