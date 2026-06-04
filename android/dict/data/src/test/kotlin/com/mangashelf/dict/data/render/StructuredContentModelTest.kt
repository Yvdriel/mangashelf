package com.mangashelf.dict.data.render

import com.mangashelf.dict.data.model.GlossStructured
import com.mangashelf.dict.data.model.GlossText
import com.mangashelf.dict.data.model.GlossaryNode
import com.mangashelf.dict.data.model.ScElement
import com.mangashelf.dict.data.model.ScList
import com.mangashelf.dict.data.model.ScText
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** D2.1 — `flatten` turns a Yomitan structured-content tree into the block/inline render model. */
class StructuredContentModelTest {

    private fun sc(content: com.mangashelf.dict.data.model.StructuredContent): List<GlossaryNode> =
        listOf(GlossStructured(content))

    private fun el(tag: String, vararg children: com.mangashelf.dict.data.model.StructuredContent) =
        ScElement(tag, ScList(children.toList()))

    @Test
    fun plainText_isOneParagraph() {
        assertEquals(
            listOf(Paragraph(listOf(TextRun("to eat")))),
            StructuredContentModel.flatten(listOf(GlossText("to eat"))),
        )
    }

    @Test
    fun orderedList_numbersItems() {
        val blocks = StructuredContentModel.flatten(
            sc(el("ol", el("li", ScText("a")), el("li", ScText("b")))),
        )
        assertEquals(
            listOf(
                ListItem("1.", listOf(TextRun("a"))),
                ListItem("2.", listOf(TextRun("b"))),
            ),
            blocks,
        )
    }

    @Test
    fun unorderedList_bulletsItems() {
        val blocks = StructuredContentModel.flatten(sc(el("ul", el("li", ScText("x")))))
        assertEquals(listOf(ListItem("•", listOf(TextRun("x")))), blocks)
    }

    @Test
    fun ruby_becomesFuriganaInline() {
        val blocks = StructuredContentModel.flatten(sc(el("ruby", ScText("食"), el("rt", ScText("た")))))
        assertEquals(listOf(Paragraph(listOf(Ruby("食", "た")))), blocks)
    }

    @Test
    fun rubyWithRp_dropsParenthesesFromReading() {
        val blocks = StructuredContentModel.flatten(
            sc(el("ruby", ScText("漢"), el("rp", ScText("(")), el("rt", ScText("かん")), el("rp", ScText(")")))),
        )
        assertEquals(listOf(Paragraph(listOf(Ruby("漢", "かん")))), blocks)
    }

    @Test
    fun nonAllowlistedTag_isDropped() {
        assertTrue(StructuredContentModel.flatten(sc(el("script", ScText("x")))).isEmpty())
    }

    @Test
    fun br_splitsParagraphs() {
        val blocks = StructuredContentModel.flatten(sc(el("div", ScText("a"), ScElement("br"), ScText("b"))))
        assertEquals(
            listOf(Paragraph(listOf(TextRun("a"))), Paragraph(listOf(TextRun("b")))),
            blocks,
        )
    }
}
