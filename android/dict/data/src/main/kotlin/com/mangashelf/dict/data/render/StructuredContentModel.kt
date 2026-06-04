package com.mangashelf.dict.data.render

import com.mangashelf.dict.data.model.GlossImage
import com.mangashelf.dict.data.model.GlossStructured
import com.mangashelf.dict.data.model.GlossText
import com.mangashelf.dict.data.model.GlossaryNode
import com.mangashelf.dict.data.model.ScElement
import com.mangashelf.dict.data.model.ScList
import com.mangashelf.dict.data.model.ScText
import com.mangashelf.dict.data.model.StructuredContent

/** Inline run inside a rendered block. */
sealed interface RenderInline
data class TextRun(val text: String, val bold: Boolean = false, val italic: Boolean = false) : RenderInline
data class Ruby(val base: String, val reading: String) : RenderInline

/** Block-level piece of a rendered glossary. */
sealed interface RenderBlock
data class Paragraph(val inlines: List<RenderInline>) : RenderBlock
data class ListItem(val marker: String, val inlines: List<RenderInline>) : RenderBlock

/** Tag allowlist — Yomitan structured-content schema (shared with [CardBackHtml]). */
internal val ALLOWED_SC_TAGS = setOf(
    "br", "ruby", "rt", "rp", "ul", "ol", "li", "div", "span",
    "table", "thead", "tbody", "tfoot", "tr", "td", "th", "details", "summary",
)

/**
 * D2.1 — flattens a Yomitan `GlossaryNode[]` tree into a flat block/inline model the Compose
 * renderer ([com.mangashelf.dict.data] consumers) draws on e-ink. Tree analogue of the web
 * renderer in anki-card-dialog.tsx: same allowlist, ruby→[Ruby], ul/ol→numbered/bulleted
 * [ListItem]s, non-allowlisted tags dropped, colors ignored. Pure — unit-tested off-device.
 */
object StructuredContentModel {

    fun flatten(nodes: List<GlossaryNode>): List<RenderBlock> {
        val w = Walker()
        nodes.forEach { w.glossary(it) }
        w.flushPara()
        return w.out
    }

    private class Walker {
        val out = ArrayList<RenderBlock>()
        private var buf = ArrayList<RenderInline>()

        private class ListCtx(val ordered: Boolean, var index: Int)
        private val lists = ArrayDeque<ListCtx>()

        private var rubyMode = 0 // 0 none, 1 base, 2 reading
        private val rubyBase = StringBuilder()
        private val rubyReading = StringBuilder()
        private var inRp = false

        fun flushPara() {
            if (buf.isNotEmpty()) {
                out.add(Paragraph(buf.toList()))
                buf = ArrayList()
            }
        }

        private fun flushItem() {
            val ctx = lists.lastOrNull() ?: return flushPara()
            ctx.index += 1
            out.add(ListItem(if (ctx.ordered) "${ctx.index}." else "•", buf.toList()))
            buf = ArrayList()
        }

        private fun addText(t: String) {
            if (t.isEmpty() || inRp) return // rp = ruby-fallback parens, never rendered
            when (rubyMode) {
                1 -> rubyBase.append(t)
                2 -> rubyReading.append(t)
                else -> buf.add(TextRun(t))
            }
        }

        fun glossary(n: GlossaryNode): Unit = when (n) {
            is GlossText -> addText(n.text)
            is GlossStructured -> sc(n.content)
            is GlossImage -> Unit
        }

        private fun sc(c: StructuredContent): Unit = when (c) {
            is ScText -> addText(c.text)
            is ScList -> c.items.forEach { sc(it) }
            is ScElement -> element(c)
        }

        private fun element(e: ScElement) {
            val tag = e.tag.lowercase()
            if (tag !in ALLOWED_SC_TAGS) return // drop non-allowlisted (and its content), like the web renderer
            val inner = e.content
            when (tag) {
                "br" -> flushPara()
                "div", "table", "thead", "tbody", "tfoot", "tr" -> {
                    flushPara(); inner?.let { sc(it) }; flushPara()
                }
                "span", "details", "summary" -> inner?.let { sc(it) }
                "td", "th" -> { inner?.let { sc(it) }; addText("  ") }
                "ul" -> withList(ordered = false, inner)
                "ol" -> withList(ordered = true, inner)
                "li" -> { flushPara(); inner?.let { sc(it) }; flushItem() }
                "ruby" -> {
                    rubyMode = 1; rubyBase.setLength(0); rubyReading.setLength(0); inRp = false
                    inner?.let { sc(it) }
                    buf.add(Ruby(rubyBase.toString(), rubyReading.toString()))
                    rubyMode = 0
                }
                "rt" -> { rubyMode = 2; inner?.let { sc(it) }; rubyMode = 1 }
                "rp" -> { inRp = true; inner?.let { sc(it) }; inRp = false }
                else -> inner?.let { sc(it) }
            }
        }

        private fun withList(ordered: Boolean, inner: StructuredContent?) {
            flushPara()
            lists.addLast(ListCtx(ordered, 0))
            inner?.let { sc(it) }
            lists.removeLastOrNull()
            flushPara()
        }
    }
}
