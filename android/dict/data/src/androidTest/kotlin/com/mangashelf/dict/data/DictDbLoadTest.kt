package com.mangashelf.dict.data

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.mangashelf.dict.data.model.TermHit
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File

/**
 * D1.3 spike anchor — load the prebaked dict.db on-device and prove the lookup hot-path +
 * bundled FTS5 work. Resolves the two CH.6 unknowns: (1) opening the 930 MB hand-baked DB via the
 * bundled SQLite driver, (2) FTS5 availability (API-28 framework SQLite lacks it).
 *
 * The 929 MB dict-trim.db must be pushed first (test APK can't carry it):
 *   adb -s emulator-5556 push out/dict-trim.db /data/local/tmp/dict.db
 */
@RunWith(AndroidJUnit4::class)
class DictDbLoadTest {

    private lateinit var engine: DictEngine

    @Before
    fun setUp() {
        val ctx = InstrumentationRegistry.getInstrumentation().targetContext
        val db = File(DB_PATH)
        assertTrue(
            "push dict-trim.db to $DB_PATH first (see docs/mudita-build-flow.md CH.6)",
            db.exists() && db.length() > 0L,
        )
        engine = DictEngineImpl(DictDatabaseProvider(ctx, db))
    }

    @Test
    fun exactLookup_kanjiForm_resolves() = runBlocking {
        val r = engine.lookup("食べる")
        assertNotNull("食べる must resolve", r)
        val top = r!!.hits.first()
        assertEquals("食べる", top.record.expression)
        assertEquals("たべる", top.record.reading)
    }

    @Test
    fun conjugatedLookup_deinflectsToDictForm() = runBlocking {
        val r = engine.lookup("食べました")
        assertNotNull("食べました must deinflect + resolve", r)
        val hit = r!!.hits.firstOrNull { it.record.expression == "食べる" }
        assertNotNull("must include 食べる", hit)
        assertTrue("must carry a deinflection reason chain", hit!!.reasons.isNotEmpty())
    }

    @Test
    fun romajiLookup_resolvesViaReading() = runBlocking {
        val r = engine.lookup("taberu")
        assertNotNull("romaji 'taberu' must resolve", r)
        assertTrue("must include 食べる", r!!.hits.any { it.record.expression == "食べる" })
    }

    @Test
    fun englishFts_eat_returnsTaberu() = runBlocking {
        val hits: List<TermHit> = engine.searchEnglish("eat")
        assertTrue(
            "FTS 'eat' must return 食べる (proves bundled FTS5 answers MATCH on-device)",
            hits.any { it.record.expression == "食べる" },
        )
    }

    private companion object {
        const val DB_PATH = "/data/local/tmp/dict.db"
    }
}
