package com.mangashelf.dict.data

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.mangashelf.dict.data.model.FuriganaSegment
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File

/**
 * D1.6 + D1.5 contract anchor — the full [DictEngine] surface (minus cardBackHtml, D2.1) green
 * against the prebaked dict.db. Requires the pushed DB (see [DictDbLoadTest]).
 */
@RunWith(AndroidJUnit4::class)
class DictEngineContractTest {

    private lateinit var engine: DictEngine

    @Before
    fun setUp() {
        val ctx = InstrumentationRegistry.getInstrumentation().targetContext
        val db = File("/data/local/tmp/dict.db")
        assertTrue("push dict-trim.db to /data/local/tmp/dict.db first", db.exists() && db.length() > 0L)
        engine = DictEngineImpl(DictDatabaseProvider(ctx, db))
    }

    @Test
    fun entry_taberu_hasAltFormsSensesFuriganaExamples() = runBlocking {
        val e = engine.entry(SEQ_TABERU)
        assertNotNull("entry must resolve", e)
        assertEquals("食べる", e!!.headword)
        assertEquals("たべる", e.reading)
        assertEquals(SEQ_TABERU, e.sequence)
        assertTrue("at least the headword form", e.altForms.isNotEmpty())
        assertTrue("a form carries POS v1 (in rules)", e.altForms.any { "v1" in it.rules })
        assertTrue("senses non-empty", e.senses.isNotEmpty())
        assertEquals(
            listOf(FuriganaSegment("食", "た"), FuriganaSegment("べる", null)),
            e.furigana,
        )
        assertTrue("examples non-empty", e.examples.isNotEmpty())
    }

    @Test
    fun kanji_shoku_hasMeaningsVgPathCompounds() = runBlocking {
        val k = engine.kanji("食")
        assertNotNull("kanji must resolve", k)
        assertTrue("meanings include 'eat'", k!!.meanings.any { it.contains("eat") })
        assertEquals("kanjivg/09/098df.svg", k.kanjiVgAssetPath)
        assertTrue("compounds non-empty (kanji_word)", k.compounds.isNotEmpty())
    }

    @Test
    fun radicals_listedWithStrokes() = runBlocking {
        val rads = engine.radicals()
        assertTrue("radical grid populated", rads.size >= 100)
        assertEquals(9, rads.first { it.radical == "食" }.strokes)
    }

    @Test
    fun kanjiByRadicals_intersect_includesSelf() = runBlocking {
        val chars = engine.kanjiByRadicals(setOf("食"))
        assertTrue("食 contains its own radical", chars.contains("食"))
        assertTrue("multiple kanji share radical 食", chars.size >= 10)
    }

    @Test
    fun compounds_prefixStem_returnsTaberuFamily() = runBlocking {
        val c = engine.compounds("食べ")
        assertTrue("compounds non-empty", c.isNotEmpty())
        assertTrue("all share the 食べ prefix", c.all { it.record.expression.startsWith("食べ") })
    }

    @Test
    fun examples_taberu_returnsSentences() = runBlocking {
        val ex = engine.examples("食べる", "たべる")
        assertTrue("examples non-empty", ex.isNotEmpty())
        assertTrue("a sentence mentions 食べ", ex.any { it.jp.contains("食べ") })
    }

    // --- D1.5 unified search routing ---

    @Test
    fun search_english_routesToFts() = runBlocking {
        assertTrue(engine.search("eat").any { it.record.expression == "食べる" })
    }

    @Test
    fun searchEnglish_malformedQuery_doesNotThrow() = runBlocking {
        // Unmatched quote / bare FTS operators must be sanitized, not crash the search box.
        engine.searchEnglish("\"")
        engine.searchEnglish("eat AND")
        engine.search("eat* \"")
        // ...and a normal query still resolves through the sanitizer.
        assertTrue(engine.searchEnglish("eat").any { it.record.expression == "食べる" })
    }

    @Test
    fun search_japanese_routesToLookup() = runBlocking {
        assertTrue(engine.search("食べる").any { it.record.expression == "食べる" })
    }

    @Test
    fun search_wildcard_routesToGlob() = runBlocking {
        val r = engine.search("食べ*")
        assertTrue("wildcard non-empty", r.isNotEmpty())
        assertTrue("all share prefix", r.all { it.record.expression.startsWith("食べ") })
    }

    @Test
    fun search_tagFilter_keepsOnlyMatchingPos() = runBlocking {
        val r = engine.search("#v1 食べる")
        assertTrue("食べる is v1 → kept", r.any { it.record.expression == "食べる" })
        assertTrue("every result is v1", r.all { "v1" in it.record.rules })
    }

    private companion object {
        const val SEQ_TABERU = 1358280
    }
}
