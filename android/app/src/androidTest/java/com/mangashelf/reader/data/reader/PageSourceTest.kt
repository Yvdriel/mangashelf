package com.mangashelf.reader.data.reader

import android.graphics.Rect
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

/**
 * 4.1 ⚔ anchor (kompakt28). Real BitmapFactory / BitmapRegionDecoder against a fixture CBZ:
 *  - page enumeration + sampled-decode dimensions for pages 0/5/9,
 *  - full-res sub-region decode (≈3× the full-view scale for a 1/3-width cell),
 *  - OOM-pressure: a 16 MP page (64 MB un-sampled — exceeds the 48 MB default app heap) decodes
 *    sampled-small under the 3-bitmap LRU, evicted pages are recycled, and 30 cycles do not OOM.
 */
@RunWith(AndroidJUnit4::class)
class PageSourceTest {

    private val display = 480
    private lateinit var cbz: File

    @Before
    fun setup() {
        val ctx = InstrumentationRegistry.getInstrumentation().targetContext
        cbz = File(ctx.cacheDir, "page-source-fixture.cbz")
        // index 0 = 4096×4096 (16 MP); indices 1..9 = 1200×1800.
        val sizes = buildList {
            add(4096 to 4096)
            repeat(9) { add(1200 to 1800) }
        }
        ZipOutputStream(cbz.outputStream()).use { zip ->
            sizes.forEachIndexed { i, (w, h) ->
                val page = File(ctx.cacheDir, "p$i.png")
                LargePng.write(page, w, h)
                zip.putNextEntry(ZipEntry("%03d.png".format(i + 1)))
                page.inputStream().use { it.copyTo(zip) }
                zip.closeEntry()
                page.delete()
            }
        }
    }

    @After
    fun teardown() {
        cbz.delete()
    }

    @Test
    fun enumeratesTenPages() {
        PageSource(cbz, display).use { src ->
            assertEquals(10, src.pageCount)
        }
    }

    @Test
    fun decodesPages_sampledToNearDisplayWidth() {
        PageSource(cbz, display).use { src ->
            // 4096 / 8 = 512
            assertEquals(512, src.page(0).width)
            // 1200 / 2 = 600
            assertEquals(600, src.page(5).width)
            assertEquals(600, src.page(9).width)
        }
    }

    @Test
    fun decodeRegion_returnsFullResSubRect_atRoughly3xScale() {
        PageSource(cbz, display).use { src ->
            // Center-ish 1/3-width cell of a 1200-wide page -> 400px wide (3× magnification at display).
            val rect = Rect(400, 600, 800, 1200) // 400 × 600 in source pixels
            val region = src.decodeRegion(5, rect)
            // 400 < display(480) -> sampleSize 1 -> full-res sub-rect.
            assertEquals(400, region.width)
            assertEquals(600, region.height)
            // 1/3-width cell ⇒ ~3× the full-page view scale.
            assertEquals(3, 1200 / rect.width())
            region.recycle()
        }
    }

    @Test
    fun largePage_decodesUnderLru_recyclesEvicted_andSurvives30Cycles() {
        PageSource(cbz, display).use { src ->
            val big = src.page(0)
            assertTrue("16 MP source must decode sampled-small", big.width <= 2 * display)

            // 3-bitmap LRU: loading 3 other pages evicts page 0 -> its bitmap must be recycled.
            src.page(1); src.page(2); src.page(3)
            assertTrue("evicted page must be recycled (heap bound)", big.isRecycled)
            assertTrue(src.cachedCount() <= 3)

            // Hammer the cache including the giant page; must not OOM.
            repeat(30) { src.page(it % src.pageCount) }
            assertTrue(src.cachedCount() <= 3)
        }
    }
}
