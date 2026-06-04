package com.mangashelf.dict.data.model

/**
 * A glossary entry node. Port of the `GlossaryNode` union in src/lib/dict/types.ts.
 * A plain Yomitan gloss is either bare text or an embedded `structured-content` tree.
 */
sealed interface GlossaryNode

data class GlossText(val text: String) : GlossaryNode

data class GlossImage(
    val path: String,
    val width: Int? = null,
    val height: Int? = null,
    val title: String? = null,
) : GlossaryNode

data class GlossStructured(val content: StructuredContent) : GlossaryNode

/**
 * Yomitan structured-content tree. Port of `StructuredContent` in types.ts: a leaf string,
 * an array of children, or a tagged element with optional data/style/lang. The D2.1 renderer
 * walks this against a tag allowlist.
 */
sealed interface StructuredContent

data class ScText(val text: String) : StructuredContent

data class ScList(val items: List<StructuredContent>) : StructuredContent

data class ScElement(
    val tag: String,
    val content: StructuredContent? = null,
    val data: Map<String, String>? = null,
    val style: Map<String, String>? = null,
    val lang: String? = null,
) : StructuredContent
