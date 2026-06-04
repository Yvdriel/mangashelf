package com.mangashelf.dict.data.json

import com.mangashelf.dict.data.model.FuriganaSegment
import com.mangashelf.dict.data.model.GlossImage
import com.mangashelf.dict.data.model.GlossStructured
import com.mangashelf.dict.data.model.GlossText
import com.mangashelf.dict.data.model.GlossaryNode
import com.mangashelf.dict.data.model.ScElement
import com.mangashelf.dict.data.model.ScList
import com.mangashelf.dict.data.model.ScText
import com.mangashelf.dict.data.model.StructuredContent
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.Json

/**
 * Decoders for the JSON TEXT columns of dict.db (definitionTags, rules, onyomi, …, glossary,
 * segments). The glossary column is a heterogeneous Yomitan `GlossaryNode[]` whose elements are
 * `string | {type:"text"|"image"|"structured-content"}`; only the nested `StructuredContent`
 * (inside a `structured-content` node) adds `{tag,…}` elements and arrays. Walked by hand rather
 * than auto-deserialized. Faithful to the union in src/lib/dict/types.ts. Decode failures degrade
 * to empty rather than crash a lookup.
 */
internal object DictJson {
    private val json = Json { ignoreUnknownKeys = true; isLenient = true }

    fun stringList(s: String?): List<String> {
        if (s.isNullOrEmpty()) return emptyList()
        return runCatching {
            (json.parseToJsonElement(s) as? JsonArray)
                ?.mapNotNull { (it as? JsonPrimitive)?.contentOrNull } ?: emptyList()
        }.getOrDefault(emptyList())
    }

    fun stringMap(s: String?): Map<String, String> {
        if (s.isNullOrEmpty()) return emptyMap()
        return runCatching {
            (json.parseToJsonElement(s) as? JsonObject)
                ?.mapValues { (_, v) -> (v as? JsonPrimitive)?.content ?: v.toString() } ?: emptyMap()
        }.getOrDefault(emptyMap())
    }

    fun furigana(s: String?): List<FuriganaSegment> {
        if (s.isNullOrEmpty()) return emptyList()
        return runCatching {
            (json.parseToJsonElement(s) as? JsonArray)?.mapNotNull { el ->
                val o = el as? JsonObject ?: return@mapNotNull null
                val ruby = (o["ruby"] as? JsonPrimitive)?.contentOrNull ?: return@mapNotNull null
                FuriganaSegment(ruby, (o["rt"] as? JsonPrimitive)?.contentOrNull)
            } ?: emptyList()
        }.getOrDefault(emptyList())
    }

    fun glossary(s: String?): List<GlossaryNode> {
        if (s.isNullOrEmpty()) return emptyList()
        return runCatching {
            (json.parseToJsonElement(s) as? JsonArray)?.mapNotNull { parseGlossNode(it) } ?: emptyList()
        }.getOrDefault(emptyList())
    }

    private fun parseGlossNode(el: JsonElement): GlossaryNode? = when (el) {
        is JsonPrimitive -> if (el.isString) GlossText(el.content) else null
        is JsonObject -> when ((el["type"] as? JsonPrimitive)?.contentOrNull) {
            "text" -> (el["text"] as? JsonPrimitive)?.contentOrNull?.let { GlossText(it) }
            "image" -> (el["path"] as? JsonPrimitive)?.contentOrNull?.let {
                GlossImage(
                    it,
                    width = (el["width"] as? JsonPrimitive)?.intOrNull,
                    height = (el["height"] as? JsonPrimitive)?.intOrNull,
                    title = (el["title"] as? JsonPrimitive)?.contentOrNull,
                )
            }
            "structured-content" -> el["content"]?.let { GlossStructured(parseSc(it)) }
            else -> null
        }
        else -> null
    }

    private fun parseSc(el: JsonElement): StructuredContent = when (el) {
        is JsonArray -> ScList(el.map { parseSc(it) })
        is JsonObject -> {
            val tag = (el["tag"] as? JsonPrimitive)?.contentOrNull
            if (tag != null) {
                ScElement(
                    tag = tag,
                    content = el["content"]?.let { parseSc(it) },
                    data = (el["data"] as? JsonObject)?.mapValues { (_, v) -> (v as? JsonPrimitive)?.content ?: v.toString() },
                    style = (el["style"] as? JsonObject)?.mapValues { (_, v) -> (v as? JsonPrimitive)?.content ?: v.toString() },
                    lang = (el["lang"] as? JsonPrimitive)?.contentOrNull,
                )
            } else {
                ScText(el.toString())
            }
        }
        is JsonPrimitive -> ScText(el.content)
    }
}
