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
        val vm = ReaderViewModel(handle(), progress, factory, ReaderKeyBus())
        waitUntil { vm.state.value.bitmap != null }
        assertEquals(4, vm.state.value.pageIndex)
        assertEquals(10, vm.state.value.pageCount)
    }

    @Test
    fun next_advancesAndPersists_soReopenResumes() {
        val vm = ReaderViewModel(handle(), progress, factory, ReaderKeyBus())
        waitUntil { vm.state.value.bitmap != null }
        assertEquals(0, vm.state.value.pageIndex)

        vm.next()
        waitUntil { vm.state.value.pageIndex == 1 }
        runBlocking { assertEquals("advancing persists the page", 1, progress.resumePage(1, 1)) }
    }

    @Test
    fun prev_clampsAtFirstPage() {
        val vm = ReaderViewModel(handle(), progress, factory, ReaderKeyBus())
        waitUntil { vm.state.value.bitmap != null }
        vm.prev()
        // Stays on page 0 — no underflow.
        SystemClock.sleep(150)
        assertEquals(0, vm.state.value.pageIndex)
    }

    @Test
    fun enterZoom_centersAndDecodesRegion() {
        val vm = ReaderViewModel(handle(), progress, factory, ReaderKeyBus())
        waitUntil { vm.state.value.bitmap != null }
        vm.enterZoom()
        waitUntil { vm.state.value.regionBitmap != null }
        assertEquals(ZoomState.Zoom(4), vm.state.value.zoom)
    }

    @Test
    fun swipe_movesCell_andRedecodes() {
        val vm = ReaderViewModel(handle(), progress, factory, ReaderKeyBus())
        waitUntil { vm.state.value.bitmap != null }
        vm.enterZoom()
        waitUntil { vm.state.value.regionBitmap != null }
        vm.onZoomSwipe(SwipeDirection.Right)
        waitUntil { vm.state.value.zoom == ZoomState.Zoom(5) }
        assertEquals(true, vm.state.value.regionBitmap != null)
    }

    @Test
    fun pageTurn_isInert_whileZoomed() {
        val vm = ReaderViewModel(handle(), progress, factory, ReaderKeyBus())
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
        val vm = ReaderViewModel(handle(), progress, factory, ReaderKeyBus())
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
        val vm = ReaderViewModel(handle(), progress, missing, ReaderKeyBus())
        waitUntil { vm.state.value.error != null }
        assertEquals("no page is shown on failure", null, vm.state.value.bitmap)
    }

    @Test
    fun corruptCbz_emitsError() {
        val bad = File(ctx.cacheDir, "corrupt-fixture.cbz").apply { writeText("this is not a zip") }
        val badFactory = PageSourceFactory { _, _ -> PageSource(bad, 480) }
        val vm = ReaderViewModel(handle(), progress, badFactory, ReaderKeyBus())
        waitUntil { vm.state.value.error != null }
        bad.delete()
    }
}
