package com.mangashelf.dict.data.model

/** A dictionary match for a scanned surface. Port of `TermHit`. */
data class TermHit(
    val record: TermRow,
    val source: String,
    val reasons: List<String>,
    val dictTitle: String,
    val frequency: Int? = null,
    val frequencyDisplay: String? = null,
)

/** The result of scanning one position: the matched surface + its hits + kanji-in-surface.
 *  Port of `ScanResult`. */
data class ScanResult(
    val position: Int,
    val surface: String,
    val hits: List<TermHit>,
    val kanji: List<KanjiRow>,
)

/** An example sentence with optional per-token furigana. */
data class Sentence(val jp: String, val en: String?, val segments: List<FuriganaSegment>? = null)

/** One numbered sense (POS tags + its glossary nodes) on the entry-detail page. */
data class SenseGroup(val definitionTags: List<String>, val glossary: List<GlossaryNode>)

/** "Could be the passive/potential of X" notice surfaced on a deinflected lookup. */
data class InflectionNotice(val dictForm: String, val reasons: List<String>)

/** Full entry-detail payload (D1.6 contract). Alt forms share the same `sequence`. */
data class EntryDetail(
    val headword: String,
    val reading: String,
    val altForms: List<TermRow>,
    val senses: List<SenseGroup>,
    val kanjiInWord: List<KanjiRow>,
    val examples: List<Sentence>,
    val compounds: List<TermHit>,
    val furigana: List<FuriganaSegment>,
    val sequence: Int,
)

/** Full kanji-detail payload (D1.6 contract). [kanjiVgAssetPath] points into the SVG asset tree. */
data class KanjiDetail(
    val character: String,
    val onyomi: List<String>,
    val kunyomi: List<String>,
    val meanings: List<String>,
    val tags: List<String>,
    val stats: Map<String, String>,
    val kanjiVgAssetPath: String?,
    val compounds: List<TermHit>,
)
