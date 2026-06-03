package com.mangashelf.reader.flashcards

import com.mangashelf.reader.flashcards.data.MiningNotetype
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * F.2: the pure stock-Basic → MangaShelf Mining legacy-JSON transform, without a backend.
 * Uses a representative Anki 25.x stock "Basic" notetype skeleton.
 */
class MiningNotetypeTest {

    private val stockBasic = """
      {"id":0,"name":"Basic","type":0,"mod":0,"usn":0,"sortf":0,"did":null,
       "tmpls":[{"name":"Card 1","ord":0,"qfmt":"{{Front}}","afmt":"{{FrontSide}}\n\n<hr id=answer>\n\n{{Back}}","bqfmt":"","bafmt":"","did":null,"bfont":"","bsize":0}],
       "flds":[{"name":"Front","ord":0,"sticky":false,"rtl":false,"font":"Arial","size":20,"description":"","plainText":false,"collapsed":false,"excludeFromSearch":false,"id":111,"tag":null,"preventDeletion":false},
               {"name":"Back","ord":1,"sticky":false,"rtl":false,"font":"Arial","size":20,"description":"","plainText":false,"collapsed":false,"excludeFromSearch":false,"id":222,"tag":null,"preventDeletion":false}],
       "css":".card{color:red}","latexPre":"PRE","latexPost":"POST","latexsvg":false,
       "req":[[0,"any",[0]]],"originalStockKind":1}
    """.trimIndent()

    @Test
    fun producesFourFieldMiningModel() {
        val out = JSONObject(MiningNotetype.transformStockJson(stockBasic))

        assertEquals("MangaShelf Mining", out.getString("name"))

        val flds = out.getJSONArray("flds")
        assertEquals(4, flds.length())
        assertEquals(
            listOf("Sentence", "Image", "Definition", "Source"),
            (0 until flds.length()).map { flds.getJSONObject(it).getString("name") },
        )
        // ords are sequential 0..3
        (0 until flds.length()).forEach { assertEquals(it, flds.getJSONObject(it).getInt("ord")) }
        // cloned field ids were nulled so rslib assigns unique ones
        assertTrue(flds.getJSONObject(0).isNull("id"))
    }

    @Test
    fun usesSingleTemplateReferencingOurFields() {
        val out = JSONObject(MiningNotetype.transformStockJson(stockBasic))
        val tmpls = out.getJSONArray("tmpls")
        assertEquals(1, tmpls.length())
        val t = tmpls.getJSONObject(0)
        assertTrue(t.getString("qfmt").contains("{{Sentence}}"))
        assertTrue(t.getString("qfmt").contains("{{Image}}"))
        assertTrue(t.getString("afmt").contains("{{Definition}}"))
        assertTrue(t.getString("afmt").contains("{{Source}}"))
    }

    @Test
    fun dropsReqAndSetsEinkCssButKeepsStockBoilerplate() {
        val out = JSONObject(MiningNotetype.transformStockJson(stockBasic))
        assertFalse("req must be dropped so rslib recomputes it", out.has("req"))
        assertTrue(out.getString("css").contains("Noto Sans JP"))
        assertFalse("e-ink css must not carry colors", out.getString("css").contains("red"))
        // untouched stock keys survive
        assertEquals("PRE", out.getString("latexPre"))
        assertEquals("POST", out.getString("latexPost"))
    }
}
