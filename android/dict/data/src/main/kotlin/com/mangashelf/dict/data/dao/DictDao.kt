package com.mangashelf.dict.data.dao

import androidx.sqlite.SQLiteConnection
import androidx.sqlite.SQLiteStatement
import com.mangashelf.dict.data.json.DictJson
import com.mangashelf.dict.data.model.DictionaryRow
import com.mangashelf.dict.data.model.FrequencyRow
import com.mangashelf.dict.data.model.KanjiRow
import com.mangashelf.dict.data.model.RadicalRow
import com.mangashelf.dict.data.model.SentenceRow
import com.mangashelf.dict.data.model.TermRow

/**
 * Hand-written DAO over the prebaked dict.db [SQLiteConnection]. All keys are COLLATE BINARY in
 * the DB so `=`, `IN (…)`, and `GLOB 'x*'` are index-eligible. JSON columns are decoded by
 * [DictJson] in the row mappers, never in SQL. Port of src/lib/dict/db/queries.ts (IDB →
 * indexed `WHERE`). Not thread-safe — [com.mangashelf.dict.data.DictEngineImpl] serializes access.
 */
internal class DictDao(private val conn: SQLiteConnection) {

    fun listDictionaries(): List<DictionaryRow> = query(
        "SELECT id, title, priority FROM dictionaries ORDER BY priority",
    ) { st ->
        DictionaryRow(
            id = st.getText(0),
            title = if (st.isNull(1)) "" else st.getText(1),
            priority = if (st.isNull(2)) 1000 else st.getLong(2).toInt(),
        )
    }

    /** Bulk exact-key lookup over expression + reading (kanji-only or kana-only forms). Deduped by id. */
    fun findTermsByKeys(keys: List<String>): List<TermRow> {
        if (keys.isEmpty()) return emptyList()
        val out = ArrayList<TermRow>()
        val seen = HashSet<Long>()
        for (chunk in keys.distinct().chunked(450)) {
            val ph = chunk.joinToString(",") { "?" }
            queryTermsInto("$TERM_COLS WHERE expression IN ($ph) OR reading IN ($ph)", out, seen) { st ->
                var i = 1
                for (k in chunk) st.bindText(i++, k)
                for (k in chunk) st.bindText(i++, k)
            }
        }
        return out
    }

    fun findKanji(chars: List<String>): List<KanjiRow> {
        if (chars.isEmpty()) return emptyList()
        val distinct = chars.distinct()
        val ph = distinct.joinToString(",") { "?" }
        return query(
            "SELECT id,dict,character,onyomi,kunyomi,tags,meanings,stats FROM kanji WHERE character IN ($ph)",
            bind = { st -> var i = 1; for (c in distinct) st.bindText(i++, c) },
        ) { st -> kanjiRow(st) }
    }

    fun findFrequencies(exprs: List<String>): List<FrequencyRow> {
        if (exprs.isEmpty()) return emptyList()
        val distinct = exprs.distinct()
        val ph = distinct.joinToString(",") { "?" }
        return query(
            "SELECT dict,expression,reading,rank,displayValue FROM frequency WHERE expression IN ($ph)",
            bind = { st -> var i = 1; for (e in distinct) st.bindText(i++, e) },
        ) { st ->
            FrequencyRow(
                dict = st.getText(0),
                expression = st.getText(1),
                reading = if (st.isNull(2)) null else st.getText(2),
                rank = if (st.isNull(3)) null else st.getLong(3).toInt(),
                displayValue = if (st.isNull(4)) null else st.getText(4),
            )
        }
    }

    /**
     * English gloss search via the FTS5 virtual table → term_id → join terms.
     * `rank` is FTS5's built-in bm25 relevance column. A malformed MATCH expression (the caller
     * should pre-sanitize, but defence in depth) yields no results rather than a thrown exception.
     */
    fun searchGlossFts(match: String, limit: Int): List<TermRow> {
        val ids = runCatching {
            query(
                "SELECT term_id FROM gloss_fts WHERE gloss_fts MATCH ? ORDER BY rank LIMIT ?",
                bind = { st -> st.bindText(1, match); st.bindLong(2, limit.toLong()) },
            ) { st -> st.getLong(0) }
        }.getOrDefault(emptyList())
        if (ids.isEmpty()) return emptyList()
        val out = ArrayList<TermRow>()
        val seen = HashSet<Long>()
        for (chunk in ids.chunked(450)) {
            val ph = chunk.joinToString(",") { "?" }
            queryTermsInto("$TERM_COLS WHERE id IN ($ph)", out, seen) { st ->
                var i = 1
                for (id in chunk) st.bindLong(i++, id)
            }
        }
        return out
    }

    /** Left-anchored wildcard over `expression` (GLOB: `*` = any run, `?` = one char). Index-eligible. */
    fun findTermsByGlob(pattern: String, limit: Int): List<TermRow> = query(
        "$TERM_COLS WHERE expression GLOB ? ORDER BY score DESC LIMIT ?",
        bind = { st -> st.bindText(1, pattern); st.bindLong(2, limit.toLong()) },
    ) { st -> termRow(st) }

    /** Suffix wildcard via the reversed-expression column (`expressionReverse GLOB`). */
    fun findTermsByReverseGlob(pattern: String, limit: Int): List<TermRow> = query(
        "$TERM_COLS WHERE expressionReverse GLOB ? ORDER BY score DESC LIMIT ?",
        bind = { st -> st.bindText(1, pattern); st.bindLong(2, limit.toLong()) },
    ) { st -> termRow(st) }

    /** All radicals with their stroke counts, for the radical-search grid (D2.6). */
    fun radicalsWithStrokes(): List<RadicalRow> = query(
        "SELECT radical, strokes FROM radical ORDER BY strokes, radical",
    ) { st -> RadicalRow(st.getText(0), if (st.isNull(1)) null else st.getLong(1).toInt()) }

    /** Alt forms: all rows sharing a Yomitan [seq]uence (e.g. 食べる / 喰べる). */
    fun findTermsBySequence(seq: Int): List<TermRow> = query(
        "$TERM_COLS WHERE sequence = ? ORDER BY id",
        bind = { st -> st.bindLong(1, seq.toLong()) },
    ) { st -> termRow(st) }

    /** Characters whose radical set contains ALL of [radicals] (AND intersection). */
    fun kanjiByRadicalIntersect(radicals: List<String>): List<String> {
        if (radicals.isEmpty()) return emptyList()
        val ph = radicals.joinToString(",") { "?" }
        return query(
            "SELECT character FROM kanji_radical WHERE radical IN ($ph) " +
                "GROUP BY character HAVING COUNT(DISTINCT radical) = ?",
            bind = { st ->
                var i = 1
                for (r in radicals) st.bindText(i++, r)
                st.bindLong(i, radicals.size.toLong())
            },
        ) { st -> st.getText(0) }
    }

    /** Compounds containing a kanji, via the precomputed kanji_word table (ranked). */
    fun kanjiWordCompounds(character: String, limit: Int): List<TermRow> = query(
        "SELECT t.id,t.dict,t.expression,t.reading,t.expressionReverse,t.definitionTags,t.rules," +
            "t.score,t.glossary,t.sequence,t.termTags FROM kanji_word kw " +
            "JOIN terms t ON t.id = kw.term_id WHERE kw.character = ? ORDER BY kw.rank LIMIT ?",
        bind = { st -> st.bindText(1, character); st.bindLong(2, limit.toLong()) },
    ) { st -> termRow(st) }

    /** Example sentences for a headword (+ optional reading disambiguation). */
    fun examplesFor(headword: String, reading: String?, limit: Int): List<SentenceRow> {
        val sql = StringBuilder(
            "SELECT s.id, s.jp, s.en FROM sentence_word sw JOIN sentence s ON s.id = sw.sentence_id WHERE sw.headword = ?",
        )
        if (reading != null) sql.append(" AND sw.reading = ?")
        sql.append(" LIMIT ?")
        return query(sql.toString(), bind = { st ->
            var i = 1
            st.bindText(i++, headword)
            if (reading != null) st.bindText(i++, reading)
            st.bindLong(i, limit.toLong())
        }) { st -> SentenceRow(st.getLong(0), st.getText(1), if (st.isNull(2)) null else st.getText(2)) }
    }

    /** Raw `segments` JSON for a headword+reading furigana alignment (decoded by the caller). */
    fun furiganaFor(expression: String, reading: String): String? = query(
        "SELECT segments FROM furigana WHERE expression = ? AND reading = ? LIMIT 1",
        bind = { st -> st.bindText(1, expression); st.bindText(2, reading) },
    ) { st -> st.getText(0) }.firstOrNull()

    // --- row mappers ---

    private fun termRow(st: SQLiteStatement) = TermRow(
        id = st.getLong(0),
        dict = st.getText(1),
        expression = st.getText(2),
        reading = st.getText(3),
        expressionReverse = st.getText(4),
        definitionTags = DictJson.stringList(textOrNull(st, 5)),
        rules = DictJson.stringList(textOrNull(st, 6)),
        score = if (st.isNull(7)) 0 else st.getLong(7).toInt(),
        glossary = DictJson.glossary(st.getText(8)),
        sequence = if (st.isNull(9)) 0 else st.getLong(9).toInt(),
        termTags = DictJson.stringList(textOrNull(st, 10)),
    )

    private fun kanjiRow(st: SQLiteStatement) = KanjiRow(
        id = st.getLong(0),
        dict = st.getText(1),
        character = st.getText(2),
        onyomi = DictJson.stringList(textOrNull(st, 3)),
        kunyomi = DictJson.stringList(textOrNull(st, 4)),
        tags = DictJson.stringList(textOrNull(st, 5)),
        meanings = DictJson.stringList(textOrNull(st, 6)),
        stats = DictJson.stringMap(textOrNull(st, 7)),
    )

    private fun textOrNull(st: SQLiteStatement, i: Int): String? = if (st.isNull(i)) null else st.getText(i)

    // --- query helpers ---

    private inline fun <T> query(
        sql: String,
        bind: (SQLiteStatement) -> Unit = {},
        map: (SQLiteStatement) -> T,
    ): List<T> {
        val st = conn.prepare(sql)
        try {
            bind(st)
            val out = ArrayList<T>()
            while (st.step()) out.add(map(st))
            return out
        } finally {
            st.close()
        }
    }

    private inline fun queryTermsInto(
        sql: String,
        out: MutableList<TermRow>,
        seen: MutableSet<Long>,
        bind: (SQLiteStatement) -> Unit,
    ) {
        val st = conn.prepare(sql)
        try {
            bind(st)
            while (st.step()) {
                val r = termRow(st)
                if (seen.add(r.id)) out.add(r)
            }
        } finally {
            st.close()
        }
    }

    private companion object {
        const val TERM_COLS =
            "SELECT id,dict,expression,reading,expressionReverse,definitionTags,rules,score,glossary,sequence,termTags FROM terms"
    }
}
