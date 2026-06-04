package com.mangashelf.dict.data

import com.mangashelf.dict.data.dao.DictDao
import com.mangashelf.dict.data.json.DictJson
import com.mangashelf.dict.data.model.DictionaryRow
import com.mangashelf.dict.data.model.EntryDetail
import com.mangashelf.dict.data.model.FrequencyRow
import com.mangashelf.dict.data.model.KanjiDetail
import com.mangashelf.dict.data.model.KanjiRow
import com.mangashelf.dict.data.model.ScanResult
import com.mangashelf.dict.data.model.SenseGroup
import com.mangashelf.dict.data.model.Sentence
import com.mangashelf.dict.data.model.TermHit
import com.mangashelf.dict.data.model.TermRow
import com.mangashelf.dict.data.query.SearchQuery
import com.mangashelf.dict.data.render.CardBackHtml
import com.mangashelf.dict.engine.Cond
import com.mangashelf.dict.engine.ConjugationTable
import com.mangashelf.dict.engine.Conjugator
import com.mangashelf.dict.engine.JapaneseTransforms
import com.mangashelf.dict.engine.LanguageTransformer
import com.mangashelf.dict.engine.rulesToConditions
import com.mangashelf.dict.romaji.Romaji
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import javax.inject.Inject
import javax.inject.Singleton

/**
 * [DictEngine] over the prebaked dict.db. The lookup/scan hot-path ports
 * src/lib/dict/scanner.ts `scanAt`: substrings longest→shortest, deinflect each
 * ([LanguageTransformer]), one bulk exact-key lookup over the union of candidate terms, keep rows
 * whose `rules` mask intersects the candidate conditions, attach frequency, sort, attach
 * kanji-in-surface. Romaji queries are converted to kana candidates first ([Romaji]). The single
 * read connection is serialized by [mutex].
 */
@Singleton
class DictEngineImpl @Inject constructor(
    private val provider: DictDatabaseProvider,
) : DictEngine {

    private val dao: DictDao by lazy { DictDao(provider.connection()) }
    private val transformer = LanguageTransformer(JapaneseTransforms.rules)
    private val mutex = Mutex()

    override suspend fun lookup(query: String): ScanResult? = withContext(Dispatchers.IO) {
        mutex.withLock {
            for (candidate in Romaji.toKanaCandidates(query)) {
                scanAt(candidate, 0)?.let { return@withLock it }
            }
            null
        }
    }

    override suspend fun scan(text: String): List<ScanResult> = withContext(Dispatchers.IO) {
        mutex.withLock {
            val out = ArrayList<ScanResult>()
            var i = 0
            while (i < text.length) {
                val r = scanAt(text, i)
                if (r != null) {
                    out.add(r)
                    i += r.surface.length
                } else {
                    out.add(ScanResult(i, text[i].toString(), emptyList(), emptyList()))
                    i += 1
                }
            }
            out
        }
    }

    override suspend fun searchEnglish(query: String): List<TermHit> = withContext(Dispatchers.IO) {
        mutex.withLock {
            // Sanitize into a safe FTS5 MATCH: quote each word token so user punctuation/operators
            // (unmatched quotes, bare `*`, AND/OR/NEAR) can't throw a query-syntax error.
            val match = englishMatch(query)
            if (match.isEmpty()) return@withLock emptyList()
            val dictById = dao.listDictionaries().associateBy { it.id }
            // FTS5 (bm25) gives the relevance candidate pool; re-rank by frequency so common words
            // surface first (a long gloss padded with example sentences ranks poorly under bm25).
            rankByFrequency(toHits(dao.searchGlossFts(match, FTS_CANDIDATES), dictById)).take(ENGLISH_RESULTS)
        }
    }

    override suspend fun search(raw: String): List<TermHit> {
        val parsed = SearchQuery.parse(raw)
        // Each branch acquires the read lock itself — search() must NOT hold it (Mutex is
        // non-reentrant; lookup()/searchEnglish() would deadlock).
        val base = when {
            parsed.text.isBlank() -> emptyList()
            parsed.wildcard -> wildcardSearch(parsed.text)
            hasKana(parsed.text) || hasKanji(parsed.text) -> lookup(parsed.text)?.hits ?: emptyList()
            // Latin input is ambiguous — English words are also valid romaji. Only treat it as
            // romaji-Japanese when it converts CLEANLY to kana (taberu→たべる); "eat"→"えあt" keeps
            // a stray 't', so it's English → FTS. Romaji lookup still wins ties when it finds a word.
            Romaji.isRomaji(parsed.text) -> {
                val kana = Romaji.toHiragana(parsed.text)
                val romajiHits = if (kana.isNotEmpty() && kana.all { isKana(it) }) {
                    lookup(parsed.text)?.hits ?: emptyList()
                } else {
                    emptyList()
                }
                romajiHits.ifEmpty { searchEnglish(parsed.text) }
            }
            else -> searchEnglish(parsed.text)
        }
        if (parsed.tags.isEmpty()) return base
        return base.filter { h ->
            parsed.tags.all { tag -> tag in h.record.definitionTags || tag in h.record.rules }
        }
    }

    private suspend fun wildcardSearch(pattern: String): List<TermHit> = withContext(Dispatchers.IO) {
        mutex.withLock {
            val dictById = dao.listDictionaries().associateBy { it.id }
            // "*べる" (suffix) → reversed-expression GLOB; otherwise GLOB on expression as typed.
            val rows = if (pattern.startsWith("*")) {
                dao.findTermsByReverseGlob(pattern.drop(1).reversed() + "*", FTS_CANDIDATES)
            } else {
                dao.findTermsByGlob(pattern, FTS_CANDIDATES)
            }
            rankByFrequency(toHits(rows, dictById)).take(ENGLISH_RESULTS)
        }
    }

    override suspend fun entry(sequence: Int): EntryDetail? = withContext(Dispatchers.IO) {
        mutex.withLock {
            val rows = dao.findTermsBySequence(sequence)
            if (rows.isEmpty()) return@withLock null
            val primary = rows.first()
            val dictById = dao.listDictionaries().associateBy { it.id }
            val kanjiChars = uniqueKanji(primary.expression)
            val kanjiInWord =
                if (kanjiChars.isNotEmpty()) orderKanjiBySurface(dao.findKanji(kanjiChars), primary.expression) else emptyList()
            val compounds = rankByFrequency(
                toHits(dao.findTermsByGlob(primary.expression + "*", COMPOUNDS_LIMIT).filter { it.id != primary.id }, dictById),
            )
            EntryDetail(
                headword = primary.expression,
                reading = primary.reading,
                altForms = rows,
                senses = rows.map { SenseGroup(it.definitionTags, it.glossary) },
                kanjiInWord = kanjiInWord,
                examples = exampleSentences(primary.expression, primary.reading),
                compounds = compounds,
                furigana = DictJson.furigana(dao.furiganaFor(primary.expression, primary.reading)),
                sequence = sequence,
            )
        }
    }

    override fun conjugate(dictForm: String, posMask: Int): ConjugationTable =
        Conjugator.conjugate(dictForm, posMask)

    override suspend fun kanji(ch: String): KanjiDetail? = withContext(Dispatchers.IO) {
        mutex.withLock {
            val row = dao.findKanji(listOf(ch)).firstOrNull() ?: return@withLock null
            val dictById = dao.listDictionaries().associateBy { it.id }
            KanjiDetail(
                character = row.character,
                onyomi = row.onyomi,
                kunyomi = row.kunyomi,
                meanings = row.meanings,
                tags = row.tags,
                stats = row.stats,
                kanjiVgAssetPath = DictAssets.kanjiVgPath(ch),
                compounds = rankByFrequency(toHits(dao.kanjiWordCompounds(ch, COMPOUNDS_LIMIT), dictById)),
            )
        }
    }

    override suspend fun radicals(): List<com.mangashelf.dict.data.model.RadicalRow> =
        withContext(Dispatchers.IO) { mutex.withLock { dao.radicalsWithStrokes() } }

    override suspend fun kanjiByRadicals(radicals: Set<String>): List<String> = withContext(Dispatchers.IO) {
        mutex.withLock {
            if (radicals.isEmpty()) emptyList() else dao.kanjiByRadicalIntersect(radicals.toList())
        }
    }

    override suspend fun compounds(stemOrKanji: String): List<TermHit> = withContext(Dispatchers.IO) {
        mutex.withLock {
            val dictById = dao.listDictionaries().associateBy { it.id }
            val rows = if (stemOrKanji.length == 1 && hasKanji(stemOrKanji)) {
                dao.kanjiWordCompounds(stemOrKanji, COMPOUNDS_LIMIT)
            } else {
                dao.findTermsByGlob("$stemOrKanji*", COMPOUNDS_LIMIT)
            }
            rankByFrequency(toHits(rows, dictById))
        }
    }

    override suspend fun examples(headword: String, reading: String?): List<Sentence> =
        withContext(Dispatchers.IO) { mutex.withLock { exampleSentences(headword, reading) } }

    override fun cardBackHtml(hit: TermHit, senseIndex: Int?): String =
        CardBackHtml.cardBackHtml(hit, senseIndex)

    // --- scanner.ts port -----------------------------------------------------------------------

    private class Cand(val sourceLen: Int, val reasons: List<String>, val conditions: Int)

    private fun scanAt(text: String, position: Int): ScanResult? {
        val upper = minOf(MAX_LEN, text.length - position)
        if (upper <= 0) return null

        // deinflected term → candidates (each tracks its source length, reason chain, conditions).
        val candByTerm = HashMap<String, MutableList<Cand>>()
        var len = upper
        while (len >= 1) {
            val sub = text.substring(position, position + len)
            if (!hasKanji(sub) && !hasKana(sub)) break
            for (f in transformer.transform(sub, Cond.ANY)) {
                candByTerm.getOrPut(f.term) { ArrayList() }.add(Cand(len, f.reasons, f.conditions))
            }
            len--
        }
        if (candByTerm.isEmpty()) return null

        val dictById = dao.listDictionaries().associateBy { it.id }
        val rows = dao.findTermsByKeys(candByTerm.keys.toList())
        if (rows.isEmpty()) return null

        // A row matches a candidate iff its expression/reading equals the deinflected term AND its
        // rule mask intersects the candidate conditions. Anchor on the longest such source length.
        var bestLen = 0
        for (row in rows) {
            val ruleMask = rulesToConditions(row.rules)
            val chosen = candidatesFor(candByTerm, row)
                .filter { it.conditions and ruleMask != 0 }
                .maxByOrNull { it.sourceLen }
            if (chosen != null && chosen.sourceLen > bestLen) bestLen = chosen.sourceLen
        }
        if (bestLen == 0) return null
        val surface = text.substring(position, position + bestLen)

        val hits = ArrayList<TermHit>()
        for (row in rows) {
            val ruleMask = rulesToConditions(row.rules)
            val winning = candidatesFor(candByTerm, row)
                .filter { it.conditions and ruleMask != 0 && it.sourceLen == bestLen }
                .minByOrNull { it.reasons.size } ?: continue
            hits.add(
                TermHit(
                    record = row,
                    source = text.substring(position, position + winning.sourceLen),
                    reasons = winning.reasons,
                    dictTitle = dictById[row.dict]?.title ?: row.dict,
                ),
            )
        }
        if (hits.isEmpty()) return null

        val withFreq = attachFrequency(hits).sortedWith(
            compareBy(
                { it.frequency ?: Int.MAX_VALUE },
                { -it.record.score },
                { dictById[it.record.dict]?.priority ?: 1000 },
            ),
        )

        val kanjiChars = uniqueKanji(surface)
        val kanji = if (kanjiChars.isNotEmpty()) {
            orderKanjiBySurface(dao.findKanji(kanjiChars), surface)
        } else {
            emptyList()
        }

        return ScanResult(position, surface, withFreq, kanji)
    }

    private fun candidatesFor(candByTerm: Map<String, MutableList<Cand>>, row: TermRow): List<Cand> =
        candByTerm[row.expression].orEmpty() + candByTerm[row.reading].orEmpty()

    private fun toHits(rows: List<TermRow>, dictById: Map<String, DictionaryRow>): List<TermHit> =
        rows.map { TermHit(it, it.expression, emptyList(), dictById[it.dict]?.title ?: it.dict) }

    private fun rankByFrequency(hits: List<TermHit>): List<TermHit> =
        attachFrequency(hits).sortedWith(compareBy({ it.frequency ?: Int.MAX_VALUE }, { -it.record.score }))

    /** Caller must hold [mutex] — no locking here. Falls back to reading-agnostic if reading misses. */
    private fun exampleSentences(headword: String, reading: String?): List<Sentence> =
        dao.examplesFor(headword, reading, EXAMPLES_LIMIT)
            .ifEmpty { if (reading != null) dao.examplesFor(headword, null, EXAMPLES_LIMIT) else emptyList() }
            .map { Sentence(it.jp, it.en) }

    private fun attachFrequency(hits: List<TermHit>): List<TermHit> {
        val exprs = hits.map { it.record.expression }.distinct()
        val freqByKey = HashMap<String, FrequencyRow>()
        for (f in dao.findFrequencies(exprs)) {
            val key = readingKey(f.expression, f.reading)
            val existing = freqByKey[key]
            if (existing == null || (f.rank != null && (existing.rank == null || f.rank < existing.rank))) {
                freqByKey[key] = f
            }
        }
        return hits.map { h ->
            val f = freqByKey[readingKey(h.record.expression, h.record.reading)]
                ?: freqByKey[readingKey(h.record.expression, null)]
            if (f != null) h.copy(frequency = f.rank, frequencyDisplay = f.displayValue) else h
        }
    }

    private fun uniqueKanji(s: String): List<String> {
        val seen = LinkedHashSet<String>()
        for (c in s) if (isKanji(c)) seen.add(c.toString())
        return seen.toList()
    }

    private fun orderKanjiBySurface(rows: List<KanjiRow>, surface: String): List<KanjiRow> {
        val order = HashMap<String, Int>()
        var idx = 0
        for (c in surface) {
            val s = c.toString()
            if (isKanji(c) && !order.containsKey(s)) order[s] = idx++
        }
        return rows.sortedBy { order[it.character] ?: Int.MAX_VALUE }
    }

    private companion object {
        const val MAX_LEN = 16
        // FTS5 candidate pool (bm25-ranked) re-sorted by frequency; capped output to the UI.
        const val FTS_CANDIDATES = 500
        const val ENGLISH_RESULTS = 100
        const val COMPOUNDS_LIMIT = 50
        const val EXAMPLES_LIMIT = 20

        fun readingKey(expression: String, reading: String?): String = "$expression|${reading ?: ""}"

        private val FTS_TOKEN = Regex("[^\\p{L}\\p{N}']+")

        /** Quote each word token → an FTS5 MATCH string immune to user punctuation/operators. */
        fun englishMatch(raw: String): String =
            raw.split(FTS_TOKEN).filter { it.isNotBlank() }
                .joinToString(" ") { "\"" + it.replace("\"", "\"\"") + "\"" }

        // KANJI_RE /[一-鿿㐀-䶿]/ — CJK Unified + Ext A. KANA_RE /[぀-ヿｦ-ﾟ]/ — kana + halfwidth.
        fun isKanji(c: Char): Boolean = c.code in 0x4E00..0x9FFF || c.code in 0x3400..0x4DBF
        fun isKana(c: Char): Boolean = c.code in 0x3040..0x30FF || c.code in 0xFF66..0xFF9F
        fun hasKanji(s: String): Boolean = s.any { isKanji(it) }
        fun hasKana(s: String): Boolean = s.any { isKana(it) }
    }
}
