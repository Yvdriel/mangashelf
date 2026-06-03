package com.mangashelf.reader.flashcards.data

/**
 * Port of the web `src/lib/anki/tag-template.ts` `expandTags()`: substitutes the
 * `{series}` / `{volume}` / `{page}` / `{date}` placeholders in mining tags, collapses whitespace
 * in the series name to underscores, trims, and drops empties. Unknown placeholders are left
 * untouched. `date` is supplied by the caller (ISO `yyyy-MM-dd`) so this stays pure/testable.
 */
object TagTemplate {
    data class Ctx(val series: String, val volume: Int, val page: Int, val date: String)

    private val VARIABLES = listOf("{series}", "{volume}", "{page}", "{date}")
    private val WHITESPACE = Regex("\\s+")

    fun expand(tags: List<String>, ctx: Ctx): List<String> {
        val replacements = mapOf(
            "{series}" to ctx.series.replace(WHITESPACE, "_"),
            "{volume}" to ctx.volume.toString(),
            "{page}" to ctx.page.toString(),
            "{date}" to ctx.date,
        )
        return tags
            .map { tag -> VARIABLES.fold(tag) { acc, key -> acc.replace(key, replacements.getValue(key)) } }
            .map { it.trim() }
            .filter { it.isNotEmpty() }
    }
}
