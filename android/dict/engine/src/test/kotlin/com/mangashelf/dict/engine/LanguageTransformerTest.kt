package com.mangashelf.dict.engine

import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * D1.1 — faithful port of src/lib/dict/transforms/language-transformer.test.ts.
 * The deinflection BFS must reach the dictionary form for each inflected input.
 */
class LanguageTransformerTest {
    private val t = LanguageTransformer(JapaneseTransforms.rules)

    private fun reaches(input: String, target: String): Boolean =
        t.transform(input, Cond.ANY).any { it.term == target }

    @Test fun `食べさせられた to 食べる (past causative-passive)`() {
        assertTrue(reaches("食べさせられた", "食べる"))
    }

    @Test fun `走った to 走る (godan-ru past)`() {
        assertTrue(reaches("走った", "走る"))
    }

    @Test fun `美しくない to 美しい (i-adj negative)`() {
        assertTrue(reaches("美しくない", "美しい"))
    }

    @Test fun `してしまった to する (te-shimau + past)`() {
        assertTrue(reaches("してしまった", "する"))
    }

    @Test fun `飲みたかった to 飲む (-tai + i-past + godan)`() {
        assertTrue(reaches("飲みたかった", "飲む"))
    }

    @Test fun `書いた to 書く (godan-ku past)`() {
        assertTrue(reaches("書いた", "書く"))
    }

    @Test fun `食べました to 食べる (V1 polite past)`() {
        assertTrue(reaches("食べました", "食べる"))
    }

    @Test fun `飲まない to 飲む (godan negative)`() {
        assertTrue(reaches("飲まない", "飲む"))
    }

    @Test fun `includes the input as the zero-deinflection candidate`() {
        val forms = t.transform("食べる", Cond.ANY)
        assertTrue(forms.any { it.term == "食べる" && it.reasons.isEmpty() })
    }
}
