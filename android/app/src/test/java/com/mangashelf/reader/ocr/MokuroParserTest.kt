package com.mangashelf.reader.ocr

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * O.2: parse the on-device `.mokuro` JSON into the native model. Mirrors the web shape
 * (`src/lib/mokuro.ts`): page → blocks → box[x1,y1,x2,y2] + vertical + font_size + lines.
 * Pure (kotlinx.serialization, no Android) so it unit-tests without a device. Unknown mokuro
 * fields (version, lines_coords, *_uuid) are ignored.
 */
class MokuroParserTest {

    private val sample = """
        {
          "version": "0.2.1",
          "title": "Sample",
          "title_uuid": "abc",
          "volume": "v01",
          "pages": [
            {
              "version": "0.2.1",
              "img_width": 1488,
              "img_height": 2266,
              "img_path": "001.jpg",
              "blocks": [
                {
                  "box": [100, 200, 340, 900],
                  "vertical": true,
                  "font_size": 48.0,
                  "lines_coords": [[[1,2],[3,4]]],
                  "lines": ["こんにちは", "世界"]
                },
                {
                  "box": [500, 50, 900, 180],
                  "vertical": false,
                  "font_size": 22.0,
                  "lines": ["YO"]
                }
              ]
            },
            {
              "img_width": 1488,
              "img_height": 2266,
              "img_path": "002.jpg",
              "blocks": []
            }
          ]
        }
    """.trimIndent()

    @Test
    fun parsesPagesAndDimensions() {
        val doc = MokuroParser.parse(sample)!!
        assertEquals(2, doc.pages.size)
        assertEquals(1488, doc.pages[0].imgWidth)
        assertEquals(2266, doc.pages[0].imgHeight)
        assertEquals("001.jpg", doc.pages[0].imgPath)
    }

    @Test
    fun parsesBlockBoxVerticalLines() {
        val doc = MokuroParser.parse(sample)!!
        val b = doc.pages[0].blocks[0]
        assertEquals(listOf(100, 200, 340, 900), b.box)
        assertTrue(b.vertical)
        assertEquals(listOf("こんにちは", "世界"), b.lines)
        assertEquals(48.0, b.fontSize, 0.001)
    }

    @Test
    fun parsesHorizontalBlock() {
        val doc = MokuroParser.parse(sample)!!
        val b = doc.pages[0].blocks[1]
        assertEquals(false, b.vertical)
        assertEquals(listOf("YO"), b.lines)
    }

    @Test
    fun emptyBlocksPageParses() {
        val doc = MokuroParser.parse(sample)!!
        assertTrue(doc.pages[1].blocks.isEmpty())
    }

    @Test
    fun malformedJson_returnsNull() {
        assertNull(MokuroParser.parse("{ not json"))
        assertNull(MokuroParser.parse(""))
    }
}
