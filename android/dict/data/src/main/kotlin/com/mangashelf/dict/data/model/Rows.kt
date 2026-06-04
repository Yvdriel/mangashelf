package com.mangashelf.dict.data.model

/** A row of the `terms` table (JSON columns already decoded). Port of `TermRecord`. */
data class TermRow(
    val id: Long,
    val dict: String,
    val expression: String,
    val reading: String,
    val expressionReverse: String,
    val definitionTags: List<String>,
    val rules: List<String>,
    val score: Int,
    val glossary: List<GlossaryNode>,
    val sequence: Int,
    val termTags: List<String>,
)

/** A row of the `kanji` table (KANJIDIC2). Port of `KanjiRecord`. */
data class KanjiRow(
    val id: Long,
    val dict: String,
    val character: String,
    val onyomi: List<String>,
    val kunyomi: List<String>,
    val tags: List<String>,
    val meanings: List<String>,
    val stats: Map<String, String>,
)

/** A row of the `frequency` table. Port of `FrequencyRecord`. `rank` is null for non-finite. */
data class FrequencyRow(
    val dict: String,
    val expression: String,
    val reading: String?,
    val rank: Int?,
    val displayValue: String?,
)

/** A row of the `sentence` table (Tanaka/Tatoeba example). */
data class SentenceRow(val id: Long, val jp: String, val en: String?)

/** One furigana segment from the `furigana` table's `segments` JSON. */
data class FuriganaSegment(val ruby: String, val rt: String? = null)

/** A row of the `radical` table: a radical and its stroke count (for the radical grid). */
data class RadicalRow(val radical: String, val strokes: Int?)

/** A row of the `dictionaries` table (lookup priority + display title). */
data class DictionaryRow(val id: String, val title: String, val priority: Int)
