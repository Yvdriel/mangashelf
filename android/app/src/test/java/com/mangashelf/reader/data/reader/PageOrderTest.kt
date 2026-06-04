package com.mangashelf.reader.data.reader

import org.junit.Assert.assertEquals
import org.junit.Test
import java.io.File
import java.util.zip.ZipEntry
import java.util.zip.ZipFile
import java.util.zip.ZipOutputStream

/**
 * 4.1: pure-JVM page ordering. CBZ entries come server-normalized to `001.jpg`..`NNN.jpg`, but the
 * comparator must also survive non-padded names (`2.jpg` before `10.jpg`) and watermark prefixes.
 */
class PageOrderTest {

    @Test
    fun comparator_ordersNumericRunsNumerically_notLexically() {
        val input = listOf("10.jpg", "2.jpg", "1.jpg", "100.jpg")
        val sorted = input.sortedWith(PageOrder.comparator)
        assertEquals(listOf("1.jpg", "2.jpg", "10.jpg", "100.jpg"), sorted)
    }

    @Test
    fun comparator_handlesZeroPaddedNames() {
        val input = listOf("003.jpg", "001.jpg", "010.jpg", "002.jpg")
        val sorted = input.sortedWith(PageOrder.comparator)
        assertEquals(listOf("001.jpg", "002.jpg", "003.jpg", "010.jpg"), sorted)
    }

    @Test
    fun comparator_handlesWatermarkPrefix() {
        val input = listOf("DLRAW.TO_010.jpg", "DLRAW.TO_002.jpg", "DLRAW.TO_001.jpg")
        val sorted = input.sortedWith(PageOrder.comparator)
        assertEquals(
            listOf("DLRAW.TO_001.jpg", "DLRAW.TO_002.jpg", "DLRAW.TO_010.jpg"),
            sorted,
        )
    }

    @Test
    fun imageEntryNames_filtersNonImages_andSorts() {
        val names = listOf("002.jpg", "ComicInfo.xml", "001.jpg", "cover.png", "notes.txt")
        val result = CbzIndex.imageEntryNames(names)
        assertEquals(listOf("001.jpg", "002.jpg", "cover.png"), result)
    }

    @Test
    fun enumeratesRealZip_inNaturalOrder() {
        val cbz = writeFixtureCbz(pageCount = 10)
        ZipFile(cbz).use { zip ->
            val names = zip.entries().toList().map { it.name }
            val ordered = CbzIndex.imageEntryNames(names)
            assertEquals(10, ordered.size)
            assertEquals("001.jpg", ordered.first())
            assertEquals("006.jpg", ordered[5])
            assertEquals("010.jpg", ordered.last())
        }
        cbz.delete()
    }

    /** Zips [pageCount] tiny entries named `001.jpg`..; bytes are placeholders (no decode here). */
    private fun writeFixtureCbz(pageCount: Int): File {
        val out = File.createTempFile("pageorder-fixture", ".cbz")
        ZipOutputStream(out.outputStream()).use { zip ->
            for (i in 1..pageCount) {
                zip.putNextEntry(ZipEntry("%03d.jpg".format(i)))
                zip.write(byteArrayOf(0xFF.toByte(), 0xD8.toByte(), 0xFF.toByte()))
                zip.closeEntry()
            }
        }
        return out
    }
}
