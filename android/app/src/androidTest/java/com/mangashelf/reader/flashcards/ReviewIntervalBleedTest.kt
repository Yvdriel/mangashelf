package com.mangashelf.reader.flashcards

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import anki.config.OptionalStringConfigKey
import anki.scheduler.SchedulingState
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

/**
 * F.3 regression guard — SRS interval bleed across cards (docs/mudita-build-flow.md CH.5 OPEN BUG).
 *
 * Symptom (emulator, 2026-06-03): the four next-interval button labels looked like they carried over
 * from the previously answered card — press Good on card A, advance, and card B (a different card)
 * shows an already-advanced multi-day progression instead of its own.
 *
 * The two hypotheses, and how each is detected here:
 *  - (a) DISPLAY-ONLY: the button strings are computed from a stale/other card's scheduling states.
 *        Detector: for every front card, the labels [CollectionRepository.nextCard] shows must equal
 *        a fresh `describeNextStates(getSchedulingStates(thatSameCardId))`. Same card → same FSRS
 *        fuzz seed → the two views MUST be byte-identical; a mismatch means the display bled.
 *  - (b) REAL SCHEDULING: `answerCard` binds to the wrong card/rating and corrupts the revlog.
 *        Detector: each answered card has exactly one revlog entry with the chosen button, and the
 *        interval actually written (revlog secs for a learning step, [getCard] days for a graduate)
 *        equals that same card's own fresh prediction — never a neighbour's.
 *
 * Fuzz note: FSRS fuzzes multi-day graduate intervals with a per-card seed, so two distinct fresh
 * cards may legitimately show different graduate days. We therefore never assert cross-card equality
 * on a fuzzed interval — only on the fuzz-free learning steps (Again/Hard/Good are sub-day) — and
 * lean on the per-card display==answer-source invariant, which is fuzz-immune.
 *
 * Walks five DISTINCT new cards (≥5 so the (re)learning queue can't re-show one card and mask it).
 */
@RunWith(AndroidJUnit4::class)
class ReviewIntervalBleedTest {

    private lateinit var dir: File
    private lateinit var repo: CollectionRepository

    @Before
    fun setup() {
        val ctx = InstrumentationRegistry.getInstrumentation().targetContext
        dir = File(ctx.filesDir, "test_bleed_${System.nanoTime()}")
        dir.deleteRecursively()
        repo = CollectionRepository(AnkiBackend(), dir)
    }

    @After
    fun teardown() {
        repo.close()
        dir.deleteRecursively()
    }

    /**
     * Good path (fuzz-free learning step). Every fresh card's displayed labels must equal its own
     * fresh describe, and answering Good must write exactly that card's own Good step — identical
     * across all five fresh cards, since sub-day learning steps are not fuzzed.
     */
    @Test
    fun freshCards_displayLabelsAndGoodSchedule_areEachCardsOwn() = runBlocking {
        val deckId = repo.bootstrap()
        repeat(5) { i -> repo.addMiningNote(deckId, "文$i", null, "", null, null, emptyList()) }

        data class Seen(
            val cardId: Long,
            val displayed: List<String>,
            val fresh: List<String>,
            val goodSecs: Long,
            val revButton: Int,
            val revIntervalSecs: Int,
            val revCount: Int,
        )

        val seen = mutableListOf<Seen>()
        repeat(5) {
            val card = repo.nextCard(deckId)
            assertNotNull("expected a distinct new card to still be due", card)
            val cardId = card!!.cardId
            val displayed = card.options.map { it.intervalLabel }

            val (fresh, goodSecs) = repo.onBackend { b ->
                val s = b.getSchedulingStates(cardId)
                b.describeNextStates(s) to intervalSecs(s.good)
            }

            repo.answer(cardId, Rating.GOOD)
            repo.refreshDecks() // mirror ReviewViewModel.answer()'s order: answer → refreshDecks → nextCard

            val (button, interval, count) = repo.onBackend { b ->
                val logs = b.getReviewLogs(cardId)
                Triple(logs.firstOrNull()?.buttonChosen ?: -1, logs.firstOrNull()?.interval ?: -1, logs.size)
            }
            seen += Seen(cardId, displayed, fresh, goodSecs, button, interval, count)
        }

        assertEquals(
            "expected 5 distinct cards, got ids ${seen.map { it.cardId }}",
            5, seen.map { it.cardId }.toSet().size,
        )

        // (a) DISPLAY correctness — fuzz-immune. The labels the screen shows for a card must equal a
        // fresh per-card describe of that same card; a mismatch means the labels bled from another.
        seen.forEach { s ->
            assertEquals(
                "card ${s.cardId}: screen displayed ${s.displayed} but a fresh describe of the SAME " +
                    "card gives ${s.fresh} — labels bled from another card",
                s.fresh, s.displayed,
            )
        }

        val first = seen.first()
        // Fuzz-free cross-card invariants: learning steps + Good step are identical for fresh cards.
        seen.forEachIndexed { idx, s ->
            assertEquals(
                "card #$idx (${s.cardId}) learning steps ${s.fresh.take(3)} != first ${first.fresh.take(3)}",
                first.fresh.take(3), s.fresh.take(3),
            )
            assertEquals(
                "card #$idx (${s.cardId}) Good step ${s.goodSecs}s != first ${first.goodSecs}s",
                first.goodSecs, s.goodSecs,
            )
        }

        // (b) REAL SCHEDULING — clean revlog: bound to THIS card, Good button, and the interval its
        // own Good prediction implied (revlog reports a learning step as positive seconds).
        seen.forEachIndexed { idx, s ->
            assertEquals("card #$idx (${s.cardId}) must have exactly one revlog entry", 1, s.revCount)
            assertEquals("card #$idx (${s.cardId}) revlog button must be Good(3)", 3, s.revButton)
            assertEquals(
                "card #$idx (${s.cardId}) wrote revlog ivl ${s.revIntervalSecs}s but its own Good " +
                    "prediction was ${s.goodSecs}s — written schedule diverges from displayed",
                s.goodSecs, s.revIntervalSecs.toLong(),
            )
        }
    }

    /**
     * Easy path (fuzzed multi-day graduate) — the exact shape of the reported "Good 5d" symptom.
     * Each fresh card graduates straight to a review state with a per-card-fuzzed day interval. We
     * prove the multi-day interval written for a card equals that card's OWN displayed prediction
     * (never a neighbour's), so a differing day count across cards is legitimate fuzz, not bleed.
     */
    @Test
    fun multiDayGraduate_writtenDaysMatchEachCardsOwnDisplayedPrediction() = runBlocking {
        val deckId = repo.bootstrap()
        repeat(5) { i -> repo.addMiningNote(deckId, "章$i", null, "", null, null, emptyList()) }

        data class Seen(val cardId: Long, val predictedEasyDays: Int, val writtenDays: Int, val revButton: Int)

        val seen = mutableListOf<Seen>()
        repeat(5) {
            val card = repo.nextCard(deckId)
            assertNotNull("expected a distinct new card to still be due", card)
            val cardId = card!!.cardId

            val predictedEasyDays = repo.onBackend { b ->
                val easy = b.getSchedulingStates(cardId).easy
                assertTrue("Easy must graduate a fresh card to a review state", easy.normal.hasReview())
                easy.normal.review.scheduledDays
            }

            repo.answer(cardId, Rating.EASY)
            repo.refreshDecks() // mirror ReviewViewModel.answer()'s order: answer → refreshDecks → nextCard

            val (writtenDays, button) = repo.onBackend { b ->
                b.getCard(cardId).interval to (b.getReviewLogs(cardId).firstOrNull()?.buttonChosen ?: -1)
            }
            seen += Seen(cardId, predictedEasyDays, writtenDays, button)
        }

        assertEquals(
            "expected 5 distinct cards, got ${seen.map { it.cardId }}",
            5, seen.map { it.cardId }.toSet().size,
        )

        seen.forEach { s ->
            assertEquals("card ${s.cardId} revlog button must be Easy(4)", 4, s.revButton)
            // The written multi-day interval must be THIS card's own predicted graduate, not a
            // neighbour's — order-independent, fuzz-immune (same card → same seed).
            assertEquals(
                "card ${s.cardId} wrote ${s.writtenDays}d but its OWN displayed prediction was " +
                    "${s.predictedEasyDays}d — multi-day schedule bled across cards",
                s.predictedEasyDays, s.writtenDays,
            )
            // Sanity that we are genuinely in the fuzzed FSRS graduate band (w[3] ≈ 15.69d).
            assertTrue("card ${s.cardId} graduate ${s.writtenDays}d outside FSRS band", s.writtenDays in 8..24)
        }
    }

    /**
     * The reviewer's exact scenario: multi-day **Good** on cards being re-reviewed (not fresh).
     * We graduate five cards to a real FSRS review state (each with its own memory state), force them
     * overdue so they are due today, then re-review pressing Good. Every card's displayed Good days
     * must equal a fresh per-card describe (display==answer source), and the day-interval actually
     * written must be that same card's own prediction — so the differing Good days across cards are
     * each card's legitimate schedule, never a neighbour's progression bleeding in.
     */
    @Test
    fun reviewStateCards_goodMultiDay_areEachCardsOwn_notInherited() = runBlocking {
        val deckId = repo.bootstrap()
        repeat(5) { i -> repo.addMiningNote(deckId, "復習$i", null, "", null, null, emptyList()) }

        // Graduate all five to review (Easy), giving each its own FSRS stability/difficulty.
        val graduated = mutableListOf<Long>()
        repeat(5) {
            val card = repo.nextCard(deckId)
            assertNotNull(card)
            repo.answer(card!!.cardId, Rating.EASY)
            graduated += card.cardId
        }
        // Reschedule every review card to be due today (proper RPC → invalidates the study queue,
        // unlike a raw SQL update which the cached queue would not pick up).
        repo.onBackend { b ->
            b.setDueDate(graduated, "0", OptionalStringConfigKey.getDefaultInstance())
        }
        repo.refreshDecks()

        data class Seen(
            val cardId: Long,
            val displayedGood: String,
            val freshGood: String,
            val predictedGoodDays: Int,
            val writtenDays: Int,
            val revButton: Int,
        )

        val seen = mutableListOf<Seen>()
        repeat(5) {
            val card = repo.nextCard(deckId)
            assertNotNull("expected an overdue review card to be due", card)
            val cardId = card!!.cardId
            val displayedGood = card.options.first { it.rating == Rating.GOOD }.intervalLabel

            data class Fresh(val good: String, val days: Int)
            val fresh = repo.onBackend { b ->
                val s = b.getSchedulingStates(cardId)
                assertTrue("Good on a review card must stay a review state", s.good.normal.hasReview())
                Fresh(b.describeNextStates(s)[2], s.good.normal.review.scheduledDays)
            }

            repo.answer(cardId, Rating.GOOD)
            repo.refreshDecks()

            val (writtenDays, button) = repo.onBackend { b ->
                b.getCard(cardId).interval to (b.getReviewLogs(cardId).firstOrNull()?.buttonChosen ?: -1)
            }
            seen += Seen(cardId, displayedGood, fresh.good, fresh.days, writtenDays, button)
        }

        assertEquals("expected 5 distinct review cards", 5, seen.map { it.cardId }.toSet().size)
        seen.forEach { s ->
            assertEquals(
                "card ${s.cardId}: screen showed Good ${s.displayedGood} but fresh describe gives " +
                    "${s.freshGood} — the Good label bled from another card",
                s.freshGood, s.displayedGood,
            )
            assertEquals("card ${s.cardId} revlog button must be Good(3)", 3, s.revButton)
            assertEquals(
                "card ${s.cardId} wrote ${s.writtenDays}d on Good but its OWN prediction was " +
                    "${s.predictedGoodDays}d — the Good schedule bled across cards",
                s.predictedGoodDays, s.writtenDays,
            )
        }
    }

    /** Interval of a next-state in seconds: review states are day-scheduled, learning states sec-scheduled. */
    private fun intervalSecs(s: SchedulingState): Long {
        val n = s.normal
        return when {
            n.hasReview() -> n.review.scheduledDays.toLong() * 86_400L
            n.hasLearning() -> n.learning.scheduledSecs.toLong()
            else -> 0L
        }
    }
}
