package com.mangashelf.reader.ocr

import android.os.SystemClock
import androidx.lifecycle.SavedStateHandle
import androidx.room.Room
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.mangashelf.reader.data.local.MangaShelfDatabase
import com.mangashelf.reader.data.reader.LargePng
import com.mangashelf.reader.data.reader.PageSource
import com.mangashelf.reader.data.reader.PageSourceFactory
import com.mangashelf.reader.data.repo.ProgressRepository
import com.mangashelf.reader.flashcards.data.AnkiBackend
import com.mangashelf.reader.flashcards.data.CollectionRepository
import com.mangashelf.reader.ui.nav.Routes
import com.mangashelf.reader.ui.reader.ReaderKeyBus
import com.mangashelf.reader.ui.reader.ReaderViewModel
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

/**
 * CH.9 ⚔ end-to-end gate (kompakt28, offline): the full **read → OCR → lookup → mine → study** loop
 * in one run, with REAL reader + Anki components. A conjugated bubble (食べた) resolves to its
 * dictionary form (食べる + "past"), the page region is cropped natively from the local CBZ, the
 * card is mined into the **Mining** deck, and the review renders a **non-blank back**.
 *
 * The dictionary engine is faked here only because the 930 MB dict.db bake is not present in this
 * worktree; the deinflection it stands in for (食べた→食べる) is proven independently by the JVM
 * `LanguageTransformerTest`/`ConjugatorTest`, and the real DictEngine over dict.db by the CH.6
 * `DictEngineContractTest`. Everything else here is the real on-device implementation.
 */
@RunWith(AndroidJUnit4::class)
class Ch9LoopTest {

    private lateinit var db: MangaShelfDatabase
    private lateinit var progress: ProgressRepository
    private lateinit var cbz: File
    private lateinit var ankiDir: File
    private lateinit var repo: CollectionRepository

    private val block = MokuroBlock(box = listOf(20, 20, 300, 360), vertical = true, fontSize = 24.0, lines = listOf("食べた"))
    private val mokuro = MokuroDoc(
        pages = listOf(MokuroPage(imgWidth = 480, imgHeight = 720, imgPath = "001.png", blocks = listOf(block))),
    )

    @Before
    fun setup() {
        val ctx = InstrumentationRegistry.getInstrumentation().targetContext
        db = Room.inMemoryDatabaseBuilder(ctx, MangaShelfDatabase::class.java).build()
        progress = ProgressRepository(db.progressDao()) {}
        cbz = File(ctx.cacheDir, "ch9-loop-${System.nanoTime()}.cbz")
        ZipOutputStream(cbz.outputStream()).use { zip ->
            for (i in 1..3) {
                val page = File(ctx.cacheDir, "ch9-p$i.png")
                LargePng.write(page, 480, 720)
                zip.putNextEntry(ZipEntry("%03d.png".format(i)))
                page.inputStream().use { it.copyTo(zip) }
                zip.closeEntry()
                page.delete()
            }
        }
        ankiDir = File(ctx.filesDir, "ch9-loop-anki-${System.nanoTime()}").apply { deleteRecursively() }
        repo = CollectionRepository(AnkiBackend(), ankiDir)
    }

    @After
    fun teardown() {
        repo.close()
        db.close()
        cbz.delete()
        ankiDir.deleteRecursively()
    }

    @Test
    fun fullLoop_readOcrLookupMineStudy() = runBlocking {
        val deckId = repo.bootstrap()
        val miner = OcrCardMiner { sentence, bytes, name, def, src, tags ->
            repo.addMiningNote(deckId, sentence, bytes, name, def, src, tags)
        }
        // Conjugated 食べた resolves to its dictionary form 食べる (reason: past).
        val resolved = FakeDictEngine(
            scanResults = listOf(scanResultOf("食べた", listOf(termHit("食べる", "たべる", "to eat", reasons = listOf("past"))))),
            cardBack = { hit, _ -> "<b>${hit.record.expression}</b> 【${hit.record.reading}】 — to eat" },
        )
        val vm = ReaderViewModel(
            SavedStateHandle(mapOf(Routes.READER_ARG_MANGA_ID to 1, Routes.READER_ARG_VOLUME to 1)),
            progress,
            PageSourceFactory { _, _ -> PageSource(cbz, 480) },
            MokuroSourceFactory { _, _ -> mokuro },
            miner,
            resolved,
            ReaderKeyBus(),
        )

        // 1. Open the volume → the page exposes its mokuro block to the overlay.
        waitUntil { vm.state.value.ocrPage?.blocks?.isNotEmpty() == true }

        // 2. Double-tap the bubble → popup resolves the conjugated form to the dictionary entry + crop.
        vm.onOcrBlockSelected(block, 0)
        waitUntil { vm.state.value.ocrPopup?.results?.isNotEmpty() == true && vm.state.value.ocrPopup?.image != null }
        val hit = vm.state.value.ocrPopup!!.results[0].hits[0]
        assertEquals("conjugated 食べた resolves to dict form 食べる", "食べる", hit.record.expression)
        assertEquals(listOf("past"), hit.reasons)

        // 3. Create card → it lands in the Mining deck.
        vm.onCreateCard(hit, null)
        waitUntil { vm.state.value.ocrPopup?.status != null }
        repo.refreshDecks()
        assertEquals("one card queued in Mining", 1, repo.decks().value.first { it.id == deckId }.newCount)

        // 4. Study: the next card renders FRONT (sentence) and a NON-BLANK BACK (the definition).
        val card = repo.nextCard(deckId)
        assertTrue("a due card must be returned", card != null)
        assertEquals("食べた", card!!.fields.sentence)
        assertTrue(
            "the back must render non-blank, got '${card.fields.definitionHtml}'",
            card.fields.definitionHtml.contains("食べる"),
        )
    }

    private fun waitUntil(timeoutMs: Long = 5_000, condition: () -> Boolean) {
        val deadline = SystemClock.uptimeMillis() + timeoutMs
        while (!condition()) {
            if (SystemClock.uptimeMillis() > deadline) fail("timed out waiting for loop state")
            SystemClock.sleep(15)
        }
    }
}
