package com.mangashelf.reader.flashcards

import com.mangashelf.reader.flashcards.data.TagTemplate
import org.junit.Assert.assertEquals
import org.junit.Test

/** F.8: parity with the web `tag-template.test.ts` cases. */
class TagTemplateTest {
    private val ctx = TagTemplate.Ctx(series = "One Piece", volume = 3, page = 42, date = "2026-06-03")

    @Test
    fun replacesSeriesWhitespaceWithUnderscore() {
        assertEquals(listOf("One_Piece"), TagTemplate.expand(listOf("{series}"), ctx))
    }

    @Test
    fun expandsAllVariablesAndKeepsLiterals() {
        assertEquals(
            listOf("One_Piece", "3", "42", "2026-06-03", "mangashelf"),
            TagTemplate.expand(listOf("{series}", "{volume}", "{page}", "{date}", "mangashelf"), ctx),
        )
    }

    @Test
    fun leavesUnknownPlaceholderUntouched() {
        assertEquals(listOf("{nope}"), TagTemplate.expand(listOf("{nope}"), ctx))
    }

    @Test
    fun trimsAndDropsEmpty() {
        assertEquals(listOf("a"), TagTemplate.expand(listOf("  a  ", "", "   "), ctx))
    }
}
