package com.mangashelf.reader.flashcards.ui.render

/** Inline content inside a block. */
sealed interface HtmlInline
data class Txt(val text: String, val bold: Boolean = false, val italic: Boolean = false) : HtmlInline
data class Furi(val base: String, val reading: String) : HtmlInline

/** A block-level piece of a definition. */
sealed interface HtmlBlock
data class Para(val inlines: List<HtmlInline>) : HtmlBlock
data class Item(val marker: String, val inlines: List<HtmlInline>) : HtmlBlock

/**
 * Small HTML-subset parser for the Definition field (F.3). Supports the allowlist the web mining
 * renderer uses (`anki-card-dialog.tsx` `ALLOWED_TAGS`): `b/strong`, `i/em`, `br`, `div/p`,
 * `span`, `ul/ol/li`, and `ruby/rt/rp` furigana. Everything else is stripped; colors are not
 * honoured (e-ink is black-on-white). Output is a flat block list, rendered to Compose by
 * [HtmlSubsetText]; this parse step is pure so it can be unit-tested without a backend or Compose.
 */
object HtmlSubset {

    private val TAG = Regex("<[^>]*>")

    fun parse(html: String): List<HtmlBlock> {
        val out = mutableListOf<HtmlBlock>()
        var buf = mutableListOf<HtmlInline>()
        var bold = 0
        var italic = 0

        data class ListCtx(val ordered: Boolean, var index: Int)
        val lists = ArrayDeque<ListCtx>()

        var rubyMode = 0 // 0 none, 1 base, 2 reading
        var rubyBase = StringBuilder()
        var rubyReading = StringBuilder()
        var inRp = false

        fun flushPara() {
            if (buf.isNotEmpty()) {
                out += Para(buf.toList())
                buf = mutableListOf()
            }
        }
        fun flushItem() {
            val ctx = lists.lastOrNull() ?: return flushPara()
            ctx.index += 1
            val marker = if (ctx.ordered) "${ctx.index}." else "•"
            out += Item(marker, buf.toList())
            buf = mutableListOf()
        }
        fun addText(raw: String) {
            val t = decodeEntities(raw)
            if (t.isEmpty()) return
            when (rubyMode) {
                1 -> rubyBase.append(t)
                2 -> if (!inRp) rubyReading.append(t)
                else -> buf += Txt(t, bold > 0, italic > 0)
            }
        }

        var cursor = 0
        for (m in TAG.findAll(html)) {
            addText(html.substring(cursor, m.range.first))
            cursor = m.range.last + 1

            val content = m.value.removePrefix("<").removeSuffix(">").trim()
            val isClose = content.startsWith("/")
            val name = content.removePrefix("/").trim()
                .substringBefore(' ').substringBefore('/').lowercase()

            when (name) {
                "b", "strong" -> if (isClose) bold = (bold - 1).coerceAtLeast(0) else bold++
                "i", "em" -> if (isClose) italic = (italic - 1).coerceAtLeast(0) else italic++
                "br" -> flushPara()
                "div", "p" -> flushPara()
                "ul" -> if (isClose) { flushPara(); lists.removeLastOrNull() } else lists.addLast(ListCtx(false, 0))
                "ol" -> if (isClose) { flushPara(); lists.removeLastOrNull() } else lists.addLast(ListCtx(true, 0))
                "li" -> if (isClose) flushItem() else flushPara()
                "ruby" -> if (isClose) {
                    buf += Furi(rubyBase.toString(), rubyReading.toString())
                    rubyMode = 0
                } else {
                    rubyMode = 1
                    rubyBase = StringBuilder()
                    rubyReading = StringBuilder()
                }
                "rt" -> rubyMode = if (isClose) 1 else 2
                "rp" -> inRp = !isClose
                else -> {} // span (transparent) + unknown tags: stripped, content kept
            }
        }
        addText(html.substring(cursor))
        flushPara()
        return out
    }

    private fun decodeEntities(s: String): String {
        if (s.indexOf('&') < 0) return s
        return s
            .replace("&lt;", "<")
            .replace("&gt;", ">")
            .replace("&quot;", "\"")
            .replace("&#39;", "'")
            .replace("&nbsp;", " ")
            .replace(Regex("&#(\\d+);")) { it.groupValues[1].toInt().toChar().toString() }
            .replace("&amp;", "&")
    }
}
