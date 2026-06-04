package com.mangashelf.reader.ocr

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/**
 * Native mokuro model (O.2) — the parsed shape of an on-device `.mokuro` sidecar. Mirrors the web
 * `src/lib/mokuro.ts` shape: a document is a list of pages; each page carries its source-image
 * dimensions and a list of OCR text blocks; each block is a bounding box in source-image pixels,
 * a vertical-writing flag, a font-size hint, and the recognized lines.
 *
 * Only the fields the overlay needs are modelled; every other mokuro field is ignored on parse
 * (`ignoreUnknownKeys`). Pure (kotlinx.serialization, no Android) so it unit-tests without a device.
 */
@Serializable
data class MokuroBlock(
    /** [x1, y1, x2, y2] in source-image pixels. */
    val box: List<Int> = emptyList(),
    val vertical: Boolean = false,
    @SerialName("font_size") val fontSize: Double = 0.0,
    val lines: List<String> = emptyList(),
)

@Serializable
data class MokuroPage(
    @SerialName("img_width") val imgWidth: Int = 0,
    @SerialName("img_height") val imgHeight: Int = 0,
    @SerialName("img_path") val imgPath: String? = null,
    val blocks: List<MokuroBlock> = emptyList(),
)

@Serializable
data class MokuroDoc(val pages: List<MokuroPage> = emptyList())

/**
 * The mokuro page for reader [index] / CBZ [entryName]. Prefers a match on the `img_path` basename
 * (CBZ entries may carry a folder prefix), else falls back to the positional index; null if neither
 * resolves. Pure (no Android) so the mapping is JVM-testable.
 */
fun MokuroDoc.pageFor(index: Int, entryName: String?): MokuroPage? {
    if (entryName != null) {
        val base = entryName.substringAfterLast('/')
        pages.firstOrNull { it.imgPath?.substringAfterLast('/') == base }?.let { return it }
    }
    return pages.getOrNull(index)
}

/** Parses a `.mokuro` JSON string into a [MokuroDoc], or null when the JSON is malformed. */
object MokuroParser {
    private val json = Json { ignoreUnknownKeys = true; isLenient = true }

    fun parse(jsonText: String): MokuroDoc? =
        try {
            json.decodeFromString(MokuroDoc.serializer(), jsonText)
        } catch (e: Exception) {
            null
        }
}
