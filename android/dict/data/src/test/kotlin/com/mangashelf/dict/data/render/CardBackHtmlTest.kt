package com.mangashelf.dict.data.render

import com.mangashelf.dict.data.model.GlossStructured
import com.mangashelf.dict.data.model.GlossText
import com.mangashelf.dict.data.model.GlossaryNode
import com.mangashelf.dict.data.model.ScElement
import com.mangashelf.dict.data.model.ScList
import com.mangashelf.dict.data.model.ScText
import com.mangashelf.dict.data.model.TermHit
import com.mangashelf.dict.data.model.TermRow
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** D2.1 / F.8 — the flashcard card-back HTML serializer. */
class CardBackHtmlTest {

    private fun hit(
        glossary: List<GlossaryNode>,
        definitionTags: List<String> = listOf("v1"),
        frequency: Int? = null,
    ) = TermHit(
        record = TermRow(
            id = 1, dict = "jitendex", expression = "食べる", reading = "たべる",
            expressionReverse = "るべ食", definitionTags = definitionTags, rules = listOf("v1"),
            score = 0, glossary = glossary, sequence = 1358280, termTags = emptyList(),
        ),
        source = "食べる", reasons = emptyList(), dictTitle = "Jitendex", frequency = frequency,
    )

    @Test
    fun rendersHeadwordReadingGlossTagsAndDict() {
        val html = CardBackHtml.cardBackHtml(hit(listOf(GlossText("to eat"))), null)
        assertTrue(html.contains("<b>食べる</b>"))
        assertTrue(html.contains("【たべる】"))
        assertTrue(html.contains("to eat"))
        assertTrue(html.contains("v1"))
        assertTrue(html.contains("Jitendex"))
    }

    @Test
    fun senseIndex_selectsOnlyThatSense() {
        val html = CardBackHtml.cardBackHtml(hit(listOf(GlossText("a"), GlossText("b"))), 1)
        assertTrue("keeps selected sense", html.contains(">b</li>"))
        assertFalse("drops other senses", html.contains(">a</li>"))
    }

    @Test
    fun escapesHtmlSpecialChars() {
        val html = CardBackHtml.cardBackHtml(hit(listOf(GlossText("<i> & </i>"))), null)
        assertTrue(html.contains("&lt;i&gt; &amp; &lt;/i&gt;"))
    }

    @Test
    fun serializesAllowlistedStructuredContent() {
        val node = GlossStructured(ScElement("ul", ScList(listOf(ScElement("li", ScText("x"))))))
        val html = CardBackHtml.cardBackHtml(hit(listOf(node)), null)
        assertTrue(html.contains("<ul><li>x</li></ul>"))
    }

    @Test
    fun frequency_shownWhenPresent() {
        val html = CardBackHtml.cardBackHtml(hit(listOf(GlossText("to eat")), frequency = 184), null)
        assertTrue(html.contains("freq #184"))
    }
}
