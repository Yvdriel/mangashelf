package com.mangashelf.reader.flashcards

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.mangashelf.reader.flashcards.data.AnkiBackend
import com.mangashelf.reader.flashcards.data.CollectionRepository
import com.mangashelf.reader.flashcards.data.MiningNotetype
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File

/**
 * F.2 acceptance (instrumented, arm64 / kompakt28): a fresh collection bootstraps to a "Mining"
 * deck + the "MangaShelf Mining" notetype with FSRS on at retention 0.90, and bootstrap is
 * idempotent.
 */
@RunWith(AndroidJUnit4::class)
class CollectionBootstrapTest {

    private lateinit var dir: File
    private lateinit var repo: CollectionRepository

    @Before
    fun setup() {
        val ctx = InstrumentationRegistry.getInstrumentation().targetContext
        dir = File(ctx.filesDir, "test_bootstrap_${System.nanoTime()}")
        dir.deleteRecursively()
        repo = CollectionRepository(AnkiBackend(), dir)
    }

    @After
    fun teardown() {
        repo.close()
        dir.deleteRecursively()
    }

    @Test
    fun bootstrap_createsDeckNotetype_andEnablesFsrs() = runBlocking {
        repo.bootstrap()

        assertTrue(
            "Mining deck must exist, got ${repo.decks().value.map { it.name }}",
            repo.decks().value.any { it.name == CollectionRepository.MINING_DECK },
        )

        repo.onBackend { b ->
            val ntId = b.getNotetypeIdByName(MiningNotetype.NAME)
            assertTrue("MangaShelf Mining notetype must exist", ntId != 0L)
            assertEquals("notetype must have 4 fields", 4, b.getNotetype(ntId).fieldsCount)

            val cfg = b.getDeckConfigsForUpdate(1L)
            assertTrue("FSRS must be enabled", cfg.fsrs)
            assertEquals(
                "desired retention must be 0.90",
                0.90f,
                cfg.allConfigList.first().config.config.desiredRetention,
                0.0001f,
            )
        }
    }

    @Test
    fun bootstrap_isIdempotent() = runBlocking {
        repo.bootstrap()
        repo.bootstrap()

        assertEquals(
            "exactly one Mining deck",
            1,
            repo.decks().value.count { it.name == CollectionRepository.MINING_DECK },
        )
        repo.onBackend { b ->
            assertEquals(
                "exactly one MangaShelf Mining notetype",
                1,
                b.getNotetypeNames().count { it.name == MiningNotetype.NAME },
            )
        }
    }
}
