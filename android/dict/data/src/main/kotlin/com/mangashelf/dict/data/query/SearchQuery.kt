package com.mangashelf.dict.data.query

/** A parsed search box query: the term, its `#tag` POS/misc filters, and whether it is a wildcard. */
data class ParsedQuery(val text: String, val tags: List<String>, val wildcard: Boolean)

/**
 * D1.5 — parses the unified search box. `#tag` tokens become POS/misc filters; the rest is the
 * term. A term containing `*` or `?` is a wildcard (left-anchored GLOB / `?` single-char).
 */
object SearchQuery {
    private val WS = Regex("\\s+")

    fun parse(raw: String): ParsedQuery {
        val tags = ArrayList<String>()
        val terms = ArrayList<String>()
        for (token in raw.trim().split(WS)) {
            if (token.isEmpty()) continue
            if (token.length > 1 && token.startsWith("#")) tags.add(token.substring(1)) else terms.add(token)
        }
        val text = terms.joinToString(" ")
        return ParsedQuery(text, tags, text.contains('*') || text.contains('?'))
    }
}
