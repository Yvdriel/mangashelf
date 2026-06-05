package com.mangashelf.reader.ui.reader

import android.content.Context
import android.os.SystemClock
import androidx.lifecycle.SavedStateHandle
import androidx.room.Room
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.mangashelf.reader.data.local.MangaShelfDatabase
import com.mangashelf.reader.data.reader.LargePng
import com.mangashelf.reader.data.reader.PageSource
import com.mangashelf.reader.data.reader.PageSourceFactory
import com.mangashelf.reader.data.reader.SwipeDirection
import com.mangashelf.reader.data.reader.ZoomState
import com.mangashelf.reader.data.repo.ProgressRepository
import com.mangashelf.reader.ocr.MokuroBlock
import com.mangashelf.reader.ocr.MokuroDoc
import com.mangashelf.reader.ocr.MokuroPage
import com.mangashelf.reader.ocr.FakeDictEngine
import com.mangashelf.reader.ocr.MokuroSourceFactory
import com.mangashelf.reader.ocr.OcrCardMiner
import com.mangashelf.reader.ocr.scanResultOf
import com.mangashelf.reader.ocr.termHit
import com.mangashelf.reader.ui.nav.Routes
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.fail
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

/**
 * 4.2 acceptance (kompakt28): the reader resumes on the stored page and advancing persists locally,
 * so closing + reopening lands on the same page. ViewModel is built directly (no Hilt) with a fixture
 * CBZ + in-memory Room.
 */
@RunWith(AndroidJUnit4::class)
class ReaderViewModelTest {

    private lateinit var ctx: Context
    private lateinit var db: MangaShelfDatabase
    private lateinit var progress: ProgressRepository
    private lateinit var cbz: File
    private lateinit var factory: PageSourceFactory

    // No `.mokuro` sidecar in these CH.7 fixtures → overlay simply stays off (OCR is exercised by
    // the O.2 OcrOverlay/ReaderScreen OCR tests with a real mokuro fixture).
    private val mokuro = MokuroSourceFactory { _, _ -> null }

    // Fake miner so reader tests don't open the Anki backend (D3.2 covers the real mining round-trip).
    private val miner = OcrCardMiner { _, _, _, _, _, _ -> 1L }

    // Fake dictionary (no dict.db); the real deinflection lookup is proven by the CH.9 gate.
    private val dict = FakeDictEngine()

    @Before
    fun setup() {
        ctx = InstrumentationRegistry.getInstrumentation().targetContext
        db = Room.inMemoryDatabaseBuilder(ctx, MangaShelfDatabase::class.java).build()
        progress = ProgressRepository(db.progressDao()) {} // no-op sync scheduler in tests
        cbz = File(ctx.cacheDir, "reader-vm-fixture.cbz")
        ZipOutputStream(cbz.outputStream()).use { zip ->
            for (i in 1..10) {
                val page = File(ctx.cacheDir, "vm-p$i.png")
                LargePng.write(page, 480, 720)
                zip.putNextEntry(ZipEntry("%03d.png".format(i)))
                page.inputStream().use { it.copyTo(zip) }
                zip.closeEntry()
                page.delete()
            }
        }
        factory = PageSourceFactory { _, _ -> PageSource(cbz, 480) }
    }

    @After
    fun teardown() {
        db.close()
        cbz.delete()
    }

    private fun handle() = SavedStateHandle(
        mapOf(Routes.READER_ARG_MANGA_ID to 1, Routes.READER_ARG_VOLUME to 1),
    )

    private fun waitUntil(timeoutMs: Long = 3_000, condition: () -> Boolean) {
        val deadline = SystemClock.uptimeMillis() + timeoutMs
        while (!condition()) {
            if (SystemClock.uptimeMillis() > deadline) fail("timed out waiting for reader state")
            SystemClock.sleep(10)
        }
    }

    @Test
    fun resumesFromStoredProgress() {
        runBlocking { progress.write(mangaId = 1, volumeNumber = 1, page = 4, now = 1) }
        val vm = ReaderViewModel(handle(), progress, factory, mokuro, miner, dict, ReaderKeyBus())
        waitUntil { vm.state.value.bitmap != null }
        assertEquals(4, vm.state.value.pageIndex)
        assertEquals(10, vm.state.value.pageCount)
    }

    @Test
    fun next_advancesAndPersists_soReopenResumes() {
        val vm = ReaderViewModel(handle(), progress, factory, mokuro, miner, dict, ReaderKeyBus())
        waitUntil { vm.state.value.bitmap != null }
        assertEquals(0, vm.state.value.pageIndex)

        vm.next()
        waitUntil { vm.state.value.pageIndex == 1 }
        runBlocking { assertEquals("advancing persists the page", 1, progress.resumePage(1, 1)) }
    }

    @Test
    fun prev_clampsAtFirstPage() {
        val vm = ReaderViewModel(handle(), progress, factory, mokuro, miner, dict, ReaderKeyBus())
        waitUntil { vm.state.value.bitmap != null }
        vm.prev()
        // Stays on page 0 — no underflow.
        SystemClock.sleep(150)
        assertEquals(0, vm.state.value.pageIndex)
    }

    @Test
    fun enterZoom_centersAndDecodesRegion() {
        val vm = ReaderViewModel(handle(), progress, factory, mokuro, miner, dict, ReaderKeyBus())
        waitUntil { vm.state.value.bitmap != null }
        vm.enterZoom()
        waitUntil { vm.state.value.regionBitmap != null }
        assertEquals(ZoomState.Zoom(4), vm.state.value.zoom)
    }

    @Test
    fun swipe_movesCell_andRedecodes() {
        val vm = ReaderViewModel(handle(), progress, factory, mokuro, miner, dict, ReaderKeyBus())
        waitUntil { vm.state.value.bitmap != null }
        vm.enterZoom()
        waitUntil { vm.state.value.regionBitmap != null }
        vm.onZoomSwipe(SwipeDirection.Right)
        waitUntil { vm.state.value.zoom == ZoomState.Zoom(5) }
        assertEquals(true, vm.state.value.regionBitmap != null)
    }

    @Test
    fun pageTurn_isInert_whileZoomed() {
        val vm = ReaderViewModel(handle(), progress, factory, mokuro, miner, dict, ReaderKeyBus())
        waitUntil { vm.state.value.bitmap != null }
        vm.enterZoom()
        waitUntil { vm.state.value.regionBitmap != null }
        vm.next()
        SystemClock.sleep(150)
        assertEquals(0, vm.state.value.pageIndex)
        assertEquals(ZoomState.Zoom(4), vm.state.value.zoom)
    }

    @Test
    fun exitZoom_restoresFullView_onSamePage() {
        val vm = ReaderViewModel(handle(), progress, factory, mokuro, miner, dict, ReaderKeyBus())
        waitUntil { vm.state.value.bitmap != null }
        vm.enterZoom()
        waitUntil { vm.state.value.regionBitmap != null }
        vm.exitZoom()
        assertEquals(ZoomState.FullView, vm.state.value.zoom)
        assertEquals(0, vm.state.value.pageIndex)
    }

    // CH.8/5.1 crash fix (CH.7 carry-forward): a missing or corrupt CBZ must surface as an error
    // UiState, never crash the app (PageSource's ZipFile ctor throws uncaught on bad IO).

    @Test
    fun missingCbz_emitsError_doesNotCrash() {
        val missing = PageSourceFactory { _, _ ->
            PageSource(File(ctx.cacheDir, "absent-${System.nanoTime()}.cbz"), 480)
        }
        val vm = ReaderViewModel(handle(), progress, missing, mokuro, miner, dict, ReaderKeyBus())
        waitUntil { vm.state.value.error != null }
        assertEquals("no page is shown on failure", null, vm.state.value.bitmap)
    }

    @Test
    fun corruptCbz_emitsError() {
        val bad = File(ctx.cacheDir, "corrupt-fixture.cbz").apply { writeText("this is not a zip") }
        val badFactory = PageSourceFactory { _, _ -> PageSource(bad, 480) }
        val vm = ReaderViewModel(handle(), progress, badFactory, mokuro, miner, dict, ReaderKeyBus())
        waitUntil { vm.state.value.error != null }
        bad.delete()
    }

    // O.3: a `.mokuro` mapped to page 0 surfaces blocks; selecting one opens the popup with the
    // block's joined text and a native crop decoded from the local CBZ page (no server call).
    @Test
    fun ocrBlockSelected_opensPopup_withSentenceAndNativeCrop() {
        val block = MokuroBlock(box = listOf(10, 10, 200, 200), vertical = true, fontSize = 20.0, lines = listOf("食べた"))
        val doc = MokuroDoc(pages = listOf(MokuroPage(imgWidth = 480, imgHeight = 720, imgPath = "001.png", blocks = listOf(block))))
        val withMokuro = MokuroSourceFactory { _, _ -> doc }
        val vm = ReaderViewModel(handle(), progress, factory, withMokuro, miner, dict, ReaderKeyBus())
        waitUntil { vm.state.value.ocrPage != null }
        vm.onOcrBlockSelected(block, 0)
        waitUntil { vm.state.value.ocrPopup?.image != null }
        assertEquals("食べた", vm.state.value.ocrPopup?.sentence)
    }

    // D3.1: the selected bubble text is run through DictEngine.scan(); the resolved hits (here a
    // conjugated → dictionary-form result with its reason chain) land in the popup state.
    @Test
    fun ocrBlockSelected_runsLookup_andPopulatesResults() {
        val block = MokuroBlock(box = listOf(10, 10, 200, 200), vertical = true, fontSize = 20.0, lines = listOf("食べた"))
        val doc = MokuroDoc(pages = listOf(MokuroPage(imgWidth = 480, imgHeight = 720, imgPath = "001.png", blocks = listOf(block))))
        val withMokuro = MokuroSourceFactory { _, _ -> doc }
        val resolving = FakeDictEngine(
            scanResults = listOf(scanResultOf("食べた", listOf(termHit("食べる", "たべる", "to eat", reasons = listOf("past"))))),
        )
        val vm = ReaderViewModel(handle(), progress, factory, withMokuro, miner, resolving, ReaderKeyBus())
        waitUntil { vm.state.value.ocrPage != null }
        vm.onOcrBlockSelected(block, 0)
        waitUntil { vm.state.value.ocrPopup?.results?.isNotEmpty() == true }
        val hit = vm.state.value.ocrPopup!!.results[0].hits[0]
        assertEquals("食べる", hit.record.expression)
        assertEquals(listOf("past"), hit.reasons)
    }

    // D3.2: mining a resolved hit feeds `cardBackHtml(hit, senseIndex)` into the F.8 seam as the
    // Definition field (so the review back is non-blank — see MiningNoteTest for the round-trip).
    @Test
    fun createCard_minesWithCardBackHtmlDefinition() {
        val block = MokuroBlock(box = listOf(10, 10, 200, 200), vertical = true, fontSize = 20.0, lines = listOf("食べた"))
        val doc = MokuroDoc(pages = listOf(MokuroPage(imgWidth = 480, imgHeight = 720, imgPath = "001.png", blocks = listOf(block))))
        val withMokuro = MokuroSourceFactory { _, _ -> doc }
        val resolving = FakeDictEngine(
            scanResults = listOf(scanResultOf("食べた", listOf(termHit("食べる", "たべる", "to eat", reasons = listOf("past"))))),
            cardBack = { hit, _ -> "<b>${hit.record.expression}</b>" },
        )
        var capturedDefinition: String? = "UNSET"
        val capturing = OcrCardMiner { _, _, _, def, _, _ -> capturedDefinition = def; 1L }
        val vm = ReaderViewModel(handle(), progress, factory, withMokuro, capturing, resolving, ReaderKeyBus())
        waitUntil { vm.state.value.ocrPage != null }
        vm.onOcrBlockSelected(block, 0)
        waitUntil { vm.state.value.ocrPopup?.results?.isNotEmpty() == true }
        vm.onCreateCard(vm.state.value.ocrPopup!!.results[0].hits[0], null)
        waitUntil { capturedDefinition != "UNSET" }
        assertEquals("<b>食べる</b>", capturedDefinition)
    }

    // Copilot review: selecting block→block must recycle the previous crop (48 MB heap → no leak/OOM).
    @Test
    fun selectingAnotherBlock_recyclesPreviousCrop() {
        val a = MokuroBlock(box = listOf(10, 10, 200, 200), vertical = true, fontSize = 20.0, lines = listOf("食べた"))
        val b = MokuroBlock(box = listOf(220, 10, 400, 200), vertical = false, fontSize = 18.0, lines = listOf("猫"))
        val doc = MokuroDoc(pages = listOf(MokuroPage(imgWidth = 480, imgHeight = 720, imgPath = "001.png", blocks = listOf(a, b))))
        val vm = ReaderViewModel(handle(), progress, factory, MokuroSourceFactory { _, _ -> doc }, miner, dict, ReaderKeyBus())
        waitUntil { vm.state.value.ocrPage != null }
        vm.onOcrBlockSelected(a, 0)
        waitUntil { vm.state.value.ocrPopup?.image != null }
        val firstCrop = vm.state.value.ocrPopup!!.image!!
        vm.onOcrBlockSelected(b, 1)
        waitUntil { vm.state.value.ocrPopup?.sentence == "猫" }
        assertEquals("previous crop must be recycled", true, firstCrop.isRecycled)
    }
}
