package com.mangashelf.dict.data

/**
 * Resolver for the KanjiVG asset tree (shipped as a filesystem asset tree, NOT in the DB).
 * Layout: `kanjivg/<first 2 hex of the 5-padded codepoint>/<5-padded lowercase hex>.svg`
 * — e.g. 一 U+4E00 → `kanjivg/04/04e00.svg`, 食 U+98DF → `kanjivg/09/098df.svg`.
 */
object DictAssets {
    /** Asset-relative SVG path for a single kanji, or null if [ch] is empty. */
    fun kanjiVgPath(ch: String): String? {
        if (ch.isEmpty()) return null
        val hex = String.format("%05x", ch.codePointAt(0))
        return "kanjivg/${hex.substring(0, 2)}/$hex.svg"
    }
}
