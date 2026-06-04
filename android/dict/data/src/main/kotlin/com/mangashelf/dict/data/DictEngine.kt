package com.mangashelf.dict.data

import com.mangashelf.dict.data.model.EntryDetail
import com.mangashelf.dict.data.model.KanjiDetail
import com.mangashelf.dict.data.model.ScanResult
import com.mangashelf.dict.data.model.Sentence
import com.mangashelf.dict.data.model.TermHit
import com.mangashelf.dict.engine.ConjugationTable

/**
 * The dictionary contract every consumer binds to — the standalone Dict screens (D2.*),
 * the OCR lookup popup (CH.9 O.3), and flashcard mining (F.8 via [cardBackHtml]).
 *
 * Implemented over the prebaked dict.db (CH.2) by [DictEngineImpl]. The hot path
 * ([lookup]/[scan]) is exact-key on dictionary forms after romaji→kana→deinflection,
 * NOT full-text; FTS5 is used only for [searchEnglish].
 */
interface DictEngine {
    /** Romaji→deinflect→exact-key lookup of a single word. Null if nothing matches. */
    suspend fun lookup(query: String): ScanResult?

    /** Longest-match token stream over [text] (OCR bubble / selection). */
    suspend fun scan(text: String): List<ScanResult>

    /** English→JP search over the FTS5 gloss index. */
    suspend fun searchEnglish(query: String): List<TermHit>

    /** Unified search-box entry (D2.2): routes romaji/kana/kanji/wildcard/English and applies
     *  `#tag` POS/misc filters. [lookup] stays the single-word (OCR popup) path. */
    suspend fun search(raw: String): List<TermHit>

    /** Full entry detail for all rows sharing [sequence] (alt forms, senses, examples, compounds). */
    suspend fun entry(sequence: Int): EntryDetail?

    /** Forward conjugation table — delegates to :dict:engine [com.mangashelf.dict.engine.Conjugator]. */
    fun conjugate(dictForm: String, posMask: Int): ConjugationTable

    /** KANJIDIC2 detail + KanjiVG asset path + "appears in" compounds. */
    suspend fun kanji(ch: String): KanjiDetail?

    /** All radicals with stroke counts, for the radical-search grid (D2.6). */
    suspend fun radicals(): List<com.mangashelf.dict.data.model.RadicalRow>

    /** Characters containing ALL of [radicals] (intersection over kanji_radical). */
    suspend fun kanjiByRadicals(radicals: Set<String>): List<String>

    /** Compounds for a stem (prefix GLOB) or a kanji (kanji_word join). */
    suspend fun compounds(stemOrKanji: String): List<TermHit>

    /** Example sentences for a headword (+ optional reading disambiguation). */
    suspend fun examples(headword: String, reading: String?): List<Sentence>

    /** HTML card back for flashcard mining (F.8). Reuses the structured-content serializer. */
    fun cardBackHtml(hit: TermHit, senseIndex: Int?): String
}
