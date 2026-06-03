package com.mangashelf.dict.engine

import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * D1.4 — forward conjugation. The generator reuses the SAME suffix tables as the
 * deinflector, so every reversible form it emits MUST deinflect back to the
 * dictionary form (one source of truth). Display-only forms the deinflector has
 * no inverse for (ましょう, たら, past-negative, adverbial) are flagged
 * reversible=false and excluded from the round-trip assertion.
 */
class ConjugatorTest {
    private val deinf = LanguageTransformer(JapaneseTransforms.rules)

    private fun roundTrips(dictForm: String, posMask: Int) {
        val table = Conjugator.conjugate(dictForm, posMask)
        val reversible = table.all.filter { it.reversible }
        assertTrue("$dictForm: expected reversible forms", reversible.size >= 5)
        for (c in reversible) {
            val reached = deinf.transform(c.form, Cond.ANY).any { it.term == dictForm }
            assertTrue("${c.label}='${c.form}' should deinflect back to $dictForm", reached)
        }
    }

    @Test fun `ichidan 食べる round-trips`() = roundTrips("食べる", Cond.V1)
    @Test fun `godan-mu 飲む round-trips`() = roundTrips("飲む", Cond.V5)
    @Test fun `godan-ru 走る round-trips`() = roundTrips("走る", Cond.V5)
    @Test fun `godan-ku 書く round-trips`() = roundTrips("書く", Cond.V5)
    @Test fun `godan-su 話す round-trips`() = roundTrips("話す", Cond.V5)
    @Test fun `godan-u 言う round-trips`() = roundTrips("言う", Cond.V5)
    @Test fun `i-adjective 美しい round-trips`() = roundTrips("美しい", Cond.ADJ_I)
    @Test fun `suru する round-trips`() = roundTrips("する", Cond.VS)
    @Test fun `kuru くる round-trips`() = roundTrips("くる", Cond.VK)
    @Test fun `compound suru 勉強する round-trips`() = roundTrips("勉強する", Cond.VS)

    // Forward-correctness spot checks (not just reversibility).
    @Test fun `godan 飲む surface forms`() {
        val t = Conjugator.conjugate("飲む", Cond.V5)
        val forms = t.all.map { it.form }.toSet()
        assertTrue("飲んだ" in forms)   // past
        assertTrue("飲んで" in forms)   // te
        assertTrue("飲まない" in forms) // negative
        assertTrue("飲みます" in forms) // polite
        assertTrue("飲める" in forms)   // potential
        assertTrue("飲もう" in forms)   // volitional
        assertTrue("飲めば" in forms)   // conditional
    }

    @Test fun `shape guard returns empty table on posMask-suffix mismatch`() {
        // godan input routed to the ichidan path (む != る) → no garbage forms
        assertTrue(Conjugator.conjugate("飲む", Cond.V1).all.isEmpty())
        // non-i-adjective routed to the adj path
        assertTrue(Conjugator.conjugate("元気", Cond.ADJ_I).all.isEmpty())
        // non-する / non-くる irregular inputs
        assertTrue(Conjugator.conjugate("為る", Cond.VS).all.isEmpty())
        assertTrue(Conjugator.conjugate("来る", Cond.VK).all.isEmpty())
    }

    @Test fun `ichidan 食べる surface forms`() {
        val forms = Conjugator.conjugate("食べる", Cond.V1).all.map { it.form }.toSet()
        assertTrue("食べた" in forms)
        assertTrue("食べます" in forms)
        assertTrue("食べない" in forms)
        assertTrue("食べさせる" in forms) // causative
    }
}
