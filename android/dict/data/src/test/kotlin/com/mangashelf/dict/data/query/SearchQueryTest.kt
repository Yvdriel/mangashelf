package com.mangashelf.dict.data.query

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** D1.5 — the search-box query parser: splits `#tag` POS filters from the term and flags wildcards. */
class SearchQueryTest {

    @Test
    fun plainEnglish_isJustText() {
        val p = SearchQuery.parse("eat")
        assertEquals("eat", p.text)
        assertTrue(p.tags.isEmpty())
        assertFalse(p.wildcard)
    }

    @Test
    fun tag_isStrippedFromText() {
        val p = SearchQuery.parse("#v1 食べる")
        assertEquals("食べる", p.text)
        assertEquals(listOf("v1"), p.tags)
    }

    @Test
    fun multipleTags_collected() {
        val p = SearchQuery.parse("#n #vs する")
        assertEquals("する", p.text)
        assertEquals(listOf("n", "vs"), p.tags)
    }

    @Test
    fun asteriskWildcard_detected() {
        val p = SearchQuery.parse("食*")
        assertTrue(p.wildcard)
        assertEquals("食*", p.text)
    }

    @Test
    fun questionMarkWildcard_detected() {
        assertTrue(SearchQuery.parse("食べ?").wildcard)
    }

    @Test
    fun surroundingWhitespace_trimmed() {
        assertEquals("taberu", SearchQuery.parse("  taberu  ").text)
    }

    @Test
    fun tagOnly_hasEmptyText() {
        val p = SearchQuery.parse("#v1")
        assertEquals("", p.text)
        assertEquals(listOf("v1"), p.tags)
    }
}
