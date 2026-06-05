package com.mangashelf.reader.ocr

import com.mangashelf.dict.data.DictEngine
import com.mangashelf.dict.data.model.EntryDetail
import com.mangashelf.dict.data.model.GlossText
import com.mangashelf.dict.data.model.KanjiDetail
import com.mangashelf.dict.data.model.RadicalRow
import com.mangashelf.dict.data.model.ScanResult
import com.mangashelf.dict.data.model.Sentence
import com.mangashelf.dict.data.model.TermHit
import com.mangashelf.dict.data.model.TermRow
import com.mangashelf.dict.engine.ConjugationTable

/**
 * Test double for [DictEngine] so the reader ViewModel can be exercised without the 930 MB dict.db.
 * Only [scan] and [cardBackHtml] are wired (the OCR popup's two consumers); everything else returns
 * empty/null. Real deinflection over dict.db is proven by CH.6 + the CH.9 end-to-end gate.
 */
class FakeDictEngine(
    private val scanResults: List<ScanResult> = emptyList(),
    private val cardBack: (TermHit, Int?) -> String = { _, _ -> "" },
) : DictEngine {
    override suspend fun lookup(query: String): ScanResult? = scanResults.firstOrNull()
    override suspend fun scan(text: String): List<ScanResult> = scanResults
    override suspend fun searchEnglish(query: String): List<TermHit> = emptyList()
    override suspend fun search(raw: String): List<TermHit> = emptyList()
    override suspend fun entry(sequence: Int): EntryDetail? = null
    override fun conjugate(dictForm: String, posMask: Int): ConjugationTable =
        ConjugationTable(dictForm, emptyList())
    override suspend fun kanji(ch: String): KanjiDetail? = null
    override suspend fun radicals(): List<RadicalRow> = emptyList()
    override suspend fun kanjiByRadicals(radicals: Set<String>): List<String> = emptyList()
    override suspend fun compounds(stemOrKanji: String): List<TermHit> = emptyList()
    override suspend fun examples(headword: String, reading: String?): List<Sentence> = emptyList()
    override fun cardBackHtml(hit: TermHit, senseIndex: Int?): String = cardBack(hit, senseIndex)
}

/** Builds a minimal [TermHit] for popup/mining tests. [reasons] is the deinflection chain. */
fun termHit(
    expression: String,
    reading: String,
    gloss: String,
    reasons: List<String> = emptyList(),
    sequence: Int = 1,
): TermHit = TermHit(
    record = TermRow(
        id = 0L,
        dict = "test",
        expression = expression,
        reading = reading,
        expressionReverse = reading.reversed(),
        definitionTags = listOf("v1"),
        rules = listOf("v1"),
        score = 0,
        glossary = listOf(GlossText(gloss)),
        sequence = sequence,
        termTags = emptyList(),
    ),
    source = expression,
    reasons = reasons,
    dictTitle = "Test Dict",
)

fun scanResultOf(surface: String, hits: List<TermHit>): ScanResult =
    ScanResult(position = 0, surface = surface, hits = hits, kanji = emptyList())
