package com.mangashelf.dict.romaji

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * D1.2 — wanakana parity. Verifies the dev.esnault.wanakana port matches WanaKana v4
 * on the romaji→kana edge cases the lookup hot-path depends on (shi/si, tsu/tu, ji/zi,
 * sokuon, terminal-n). A failure here is the signal to document a delta or port the trie.
 */
class RomajiTest {
    @Test fun `toHiragana basic`() {
        assertEquals("たべる", Romaji.toHiragana("taberu"))
        assertEquals("にほんご", Romaji.toHiragana("nihongo"))
    }

    @Test fun `toHiragana shi-si parity`() {
        assertEquals("し", Romaji.toHiragana("shi"))
        assertEquals("し", Romaji.toHiragana("si"))
    }

    @Test fun `toHiragana tsu-tu parity`() {
        assertEquals("つ", Romaji.toHiragana("tsu"))
        assertEquals("つ", Romaji.toHiragana("tu"))
    }

    @Test fun `toHiragana ji-zi parity`() {
        assertEquals("じ", Romaji.toHiragana("ji"))
        assertEquals("じ", Romaji.toHiragana("zi"))
    }

    @Test fun `toHiragana sokuon (double consonant)`() {
        assertEquals("きって", Romaji.toHiragana("kitte"))
        assertEquals("まって", Romaji.toHiragana("matte"))
    }

    @Test fun `toHiragana terminal and pre-consonant n`() {
        assertEquals("ほん", Romaji.toHiragana("hon"))
        assertEquals("かんじ", Romaji.toHiragana("kanji"))
    }

    @Test fun `toKatakana for loanwords`() {
        assertEquals("タベル", Romaji.toKatakana("taberu"))
        assertEquals("テレビ", Romaji.toKatakana("terebi"))
    }

    @Test fun `isRomaji gating`() {
        assertTrue(Romaji.isRomaji("taberu"))
        assertFalse(Romaji.isRomaji("食べる"))
        assertFalse(Romaji.isRomaji("たべる"))
    }
}
