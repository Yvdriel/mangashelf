package com.mangashelf.reader.ocr

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * O.2: map a reader page index + its CBZ entry name to the right mokuro page. Mokuro page order
 * and CBZ natural-sort order *should* agree, but filenames are the source of truth: prefer a match
 * on the `img_path` basename (CBZ entries may carry a folder prefix), fall back to the positional
 * index. Pure (no Android) so it unit-tests without a device.
 */
class MokuroDocTest {

    private val doc = MokuroDoc(
        pages = listOf(
            MokuroPage(imgWidth = 100, imgHeight = 200, imgPath = "001.jpg", blocks = emptyList()),
            MokuroPage(imgWidth = 100, imgHeight = 200, imgPath = "002.jpg", blocks = emptyList()),
            MokuroPage(imgWidth = 100, imgHeight = 200, imgPath = "003.jpg", blocks = emptyList()),
        ),
    )

    @Test
    fun matchesByEntryBasename_ignoringFolderPrefix() {
        // CBZ entry carries a folder prefix; mokuro img_path is the bare basename.
        val page = doc.pageFor(index = 0, entryName = "Title v01/002.jpg")
        assertEquals("002.jpg", page?.imgPath)
    }

    @Test
    fun fallsBackToPositionalIndex_whenNoNameMatch() {
        val page = doc.pageFor(index = 2, entryName = "unknown_999.png")
        assertEquals("003.jpg", page?.imgPath)
    }

    @Test
    fun fallsBackToPositionalIndex_whenEntryNameNull() {
        val page = doc.pageFor(index = 1, entryName = null)
        assertEquals("002.jpg", page?.imgPath)
    }

    @Test
    fun outOfRange_andNoNameMatch_returnsNull() {
        assertNull(doc.pageFor(index = 9, entryName = "nope.jpg"))
    }
}
