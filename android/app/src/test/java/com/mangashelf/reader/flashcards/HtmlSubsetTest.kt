package com.mangashelf.reader.flashcards

import com.mangashelf.reader.flashcards.ui.render.Furi
import com.mangashelf.reader.flashcards.ui.render.HtmlSubset
import com.mangashelf.reader.flashcards.ui.render.Item
import com.mangashelf.reader.flashcards.ui.render.Para
import com.mangashelf.reader.flashcards.ui.render.Txt
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** F.3: the pure Definition HTML-subset parser. */
class HtmlSubsetTest {

    @Test
    fun parsesBoldBreakRubyAndOrderedList() {
        val html = "<b>漢字</b><br><ruby>漢<rt>かん</rt></ruby>" +
            "<ol><li>Chinese character</li><li>kanji</li></ol>"
        val blocks = HtmlSubset.parse(html)

        assertEquals(4, blocks.size)
        assertEquals(Para(listOf(Txt("漢字", bold = true))), blocks[0])
        assertEquals(Para(listOf(Furi("漢", "かん"))), blocks[1])
        assertEquals(Item("1.", listOf(Txt("Chinese character"))), blocks[2])
        assertEquals(Item("2.", listOf(Txt("kanji"))), blocks[3])
    }

    @Test
    fun bulletListUsesDotMarker() {
        val blocks = HtmlSubset.parse("<ul><li>one</li><li>two</li></ul>")
        assertEquals(listOf("•", "•"), blocks.filterIsInstance<Item>().map { it.marker })
    }

    @Test
    fun italicAndEntitiesDecode() {
        val blocks = HtmlSubset.parse("<i>a &amp; b &#39;c&#39;</i>")
        val para = blocks.single() as Para
        assertEquals("a & b 'c'", para.inlines.filterIsInstance<Txt>().joinToString("") { it.text })
        assertTrue("italic flag set", (para.inlines.first() as Txt).italic)
    }

    @Test
    fun stripsUnknownTagsButKeepsText() {
        val blocks = HtmlSubset.parse("<span class=\"pos\">verb</span> · ichidan")
        val text = blocks.flatMap { (it as Para).inlines }.filterIsInstance<Txt>().joinToString("") { it.text }
        assertEquals("verb · ichidan", text)
    }
}
