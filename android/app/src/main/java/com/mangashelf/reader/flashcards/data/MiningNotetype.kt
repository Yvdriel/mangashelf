package com.mangashelf.reader.flashcards.data

import anki.notetypes.StockNotetype
import com.google.protobuf.ByteString
import net.ankiweb.rsdroid.Backend
import org.json.JSONArray
import org.json.JSONObject

/**
 * The "MangaShelf Mining" note type — the native counterpart of the web mining model
 * (`src/components/anki-card-dialog.tsx` `buildCardBack()` + `src/lib/settings/anki.ts`
 * field defaults). Four fields in order: Sentence, Image, Definition, Source.
 *
 * Built by cloning Anki's stock **Basic** legacy-JSON skeleton and swapping
 * name / fields / template / css. The stock skeleton supplies every required legacy key, so we
 * never hand-construct field `ord` wrappers or `req` arrays — `req` is dropped and recomputed by
 * rslib on add.
 */
object MiningNotetype {
    const val NAME = "MangaShelf Mining"

    const val FIELD_SENTENCE = "Sentence"
    const val FIELD_IMAGE = "Image"
    const val FIELD_DEFINITION = "Definition"
    const val FIELD_SOURCE = "Source"
    val FIELDS = listOf(FIELD_SENTENCE, FIELD_IMAGE, FIELD_DEFINITION, FIELD_SOURCE)

    const val TEMPLATE_NAME = "Card 1"

    // Front = sentence + image; back = front + definition + source (mirrors web buildCardBack()).
    private const val QFMT =
        "<div class=\"sentence\" lang=\"ja\">{{Sentence}}</div>\n{{Image}}"
    private const val AFMT =
        "{{FrontSide}}\n<hr id=\"answer\">\n" +
            "<div class=\"definition\">{{Definition}}</div>\n" +
            "<div class=\"source\">{{Source}}</div>"

    // e-ink: pure black-on-white, no color (the web renderer strips colors too), JP font hook.
    private val CSS = listOf(
        ".card{font-family:\"Noto Sans JP\",sans-serif;font-size:22px;color:#000;background:#fff;text-align:center}",
        ".sentence{font-size:26px;margin-bottom:.4em}",
        ".definition{text-align:left;font-size:20px;margin-top:.4em}",
        ".source{opacity:.6;font-size:14px;margin-top:.4em}",
        "hr#answer{border:none;border-top:1px solid #000;margin:.5em 0}",
    ).joinToString("\n")

    /** Existing notetype id, or creates the MangaShelf Mining notetype and returns its new id. Idempotent. */
    fun ensure(backend: Backend): Long {
        backend.getNotetypeNames().firstOrNull { it.name == NAME }?.let { return it.id }
        val stockJson = backend.getStockNotetypeLegacy(StockNotetype.Kind.KIND_BASIC).toStringUtf8()
        val json = transformStockJson(stockJson)
        return backend.addNotetypeLegacy(ByteString.copyFromUtf8(json)).id
    }

    /**
     * Pure transform (testable without a backend): turn the stock Basic legacy JSON into the
     * 4-field MangaShelf Mining model with our single template + e-ink css.
     */
    fun transformStockJson(stockJson: String): String {
        val model = JSONObject(stockJson)
        model.put("name", NAME)
        model.put("id", 0)
        model.put("sortf", 0)

        val fieldProto = model.getJSONArray("flds").getJSONObject(0)
        val flds = JSONArray()
        FIELDS.forEachIndexed { ord, fieldName ->
            val f = JSONObject(fieldProto.toString()) // deep copy of a valid stock field dict
            f.put("name", fieldName)
            f.put("ord", ord)
            if (f.has("id")) f.put("id", JSONObject.NULL) // let rslib assign unique field ids
            flds.put(f)
        }
        model.put("flds", flds)

        val tmpl = model.getJSONArray("tmpls").getJSONObject(0)
        tmpl.put("name", TEMPLATE_NAME)
        tmpl.put("ord", 0)
        tmpl.put("qfmt", QFMT)
        tmpl.put("afmt", AFMT)
        model.put("tmpls", JSONArray().put(tmpl))

        model.put("css", CSS)
        model.remove("req") // recomputed by rslib on add
        return model.toString()
    }
}
