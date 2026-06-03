package com.mangashelf.dict.romaji

import dev.esnault.wanakana.core.Wanakana

/**
 * D1.2 — romaji↔kana front-end for the lookup hot-path. Thin wrapper over the
 * pure-Kotlin WanaKana v4 port. The deinflector keys on dictionary forms, so a
 * romaji query is converted to BOTH hiragana and katakana (cheap; katakana covers
 * loanwords) before deinflection. [isRomaji] gates the conversion — kana/kanji
 * queries skip it.
 */
object Romaji {
    fun toHiragana(input: String): String = Wanakana.toHiragana(input)

    fun toKatakana(input: String): String = Wanakana.toKatakana(input)

    /** True when [input] is entirely romaji (Latin) — gate before converting. */
    fun isRomaji(input: String): Boolean = Wanakana.isRomaji(input)

    /** Lookup-time candidates for a romaji query: hiragana first (most words), then
     *  the katakana form (loanwords). Returns the input unchanged if not romaji. */
    fun toKanaCandidates(input: String): List<String> =
        if (isRomaji(input)) listOf(toHiragana(input), toKatakana(input)).distinct()
        else listOf(input)
}
