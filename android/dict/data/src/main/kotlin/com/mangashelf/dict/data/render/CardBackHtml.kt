package com.mangashelf.dict.data.render

import com.mangashelf.dict.data.model.GlossImage
import com.mangashelf.dict.data.model.GlossStructured
import com.mangashelf.dict.data.model.GlossText
import com.mangashelf.dict.data.model.GlossaryNode
import com.mangashelf.dict.data.model.ScElement
import com.mangashelf.dict.data.model.ScList
import com.mangashelf.dict.data.model.ScText
import com.mangashelf.dict.data.model.StructuredContent
import com.mangashelf.dict.data.model.TermHit

/**
 * D2.1 / F.8 — serializes a [TermHit] to the Anki card-back HTML. Port of `buildCardBack` +
 * `renderStructuredHTML` in src/components/anki-card-dialog.tsx, over the SAME node model and
 * allowlist the on-screen renderer uses ([StructuredContentModel]) — one source of truth, the two
 * diverge only at the leaf (Compose node vs HTML string). Colors stripped (e-ink); `img` dropped.
 */
object CardBackHtml {

    fun cardBackHtml(hit: TermHit, senseIndex: Int?): String {
        val expr = escapeHtml(hit.record.expression)
        val reading = if (hit.record.reading.isNotEmpty() && hit.record.reading != hit.record.expression) {
            "<span style=\"opacity:.75;font-weight:normal\"> 【${escapeHtml(hit.record.reading)}】</span>"
        } else {
            ""
        }
        val senses = if (senseIndex != null) {
            listOfNotNull(hit.record.glossary.getOrNull(senseIndex))
        } else {
            hit.record.glossary
        }
        val senseHtml = senses.joinToString("") { "<li style=\"margin:.25em 0\">${renderGlossary(it)}</li>" }
        val cleanTags = hit.record.definitionTags.filter { it.isNotEmpty() && it != "*" }
        val pos = if (cleanTags.isNotEmpty()) {
            "<div style=\"margin:.2em 0;font-size:.78em;opacity:.7;text-transform:lowercase\">" +
                cleanTags.joinToString(" · ") { escapeHtml(it) } + "</div>"
        } else {
            ""
        }
        val freq = if (hit.frequency != null) " · freq #${hit.frequency}" else ""
        val meta = "<div style=\"opacity:.6;font-size:.78em;margin-top:.4em\">${escapeHtml(hit.dictTitle)}$freq</div>"
        val inner = listOf(
            "<div lang=\"ja\" style=\"font-size:1.1em\"><b>$expr</b>$reading</div>",
            pos,
            "<ol style=\"margin:.3em 0 .3em 1.4em;padding:0;text-align:left\">$senseHtml</ol>",
            meta,
        ).filter { it.isNotEmpty() }.joinToString("")
        return "<div style=\"display:inline-block;text-align:left;max-width:90%\">$inner</div>"
    }

    private fun renderGlossary(node: GlossaryNode): String = when (node) {
        is GlossText -> escapeHtml(node.text)
        is GlossStructured -> renderStructured(node.content)
        is GlossImage -> "" // img dropped — no media support on the card back
    }

    private fun renderStructured(content: StructuredContent): String = when (content) {
        is ScText -> escapeHtml(content.text)
        is ScList -> content.items.joinToString("") { renderStructured(it) }
        is ScElement -> {
            val tag = content.tag.lowercase()
            when {
                tag !in ALLOWED_SC_TAGS -> ""
                tag == "br" -> "<br>"
                else -> {
                    val attrs = buildList {
                        dataToClassName(content.data)?.let { add("class=\"${escapeHtml(it)}\"") }
                        serializeStyle(content.style).takeIf { it.isNotEmpty() }?.let { add("style=\"${escapeHtml(it)}\"") }
                        content.lang?.let { add("lang=\"${escapeHtml(it)}\"") }
                    }
                    val open = if (attrs.isEmpty()) "<$tag>" else "<$tag ${attrs.joinToString(" ")}>"
                    "$open${content.content?.let { renderStructured(it) } ?: ""}</$tag>"
                }
            }
        }
    }

    private fun dataToClassName(data: Map<String, String>?): String? {
        if (data.isNullOrEmpty()) return null
        return data.entries.flatMap { (k, v) -> listOf("sc-$k-${cssSafe(v)}", "sc-$k") }.joinToString(" ")
    }

    private fun cssSafe(v: String): String = v.replace(Regex("[^a-zA-Z0-9_-]"), "_")

    private fun serializeStyle(style: Map<String, String>?): String {
        if (style.isNullOrEmpty()) return ""
        return style.entries
            .filter { it.key != "color" && it.key != "background" && it.key != "backgroundColor" }
            .joinToString(";") { (k, v) -> "${k.replace(Regex("[A-Z]")) { "-${it.value.lowercase()}" }}:$v" }
    }

    private fun escapeHtml(s: String): String = s
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace("\"", "&quot;")
        .replace("'", "&#39;")
}
