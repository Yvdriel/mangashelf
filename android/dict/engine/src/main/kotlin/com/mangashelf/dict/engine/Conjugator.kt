package com.mangashelf.dict.engine

/** One conjugated form. [reversible] = the deinflector has an inverse rule for it
 *  (so generate→deinflect returns the dict form). Display-only forms the engine
 *  cannot reverse (ましょう, たら, past-negative, adverbial) are reversible=false. */
data class Conjugation(val label: String, val form: String, val reversible: Boolean = true)

data class ConjugationGroup(val name: String, val forms: List<Conjugation>)

data class ConjugationTable(val dictForm: String, val groups: List<ConjugationGroup>) {
    val all: List<Conjugation> get() = groups.flatMap { it.forms }
}

/**
 * Forward conjugation generator. Runs the SAME GODAN_ROWS / GODAN_PAST_TE tables as
 * [JapaneseTransforms] in reverse direction, plus hardcoded irregulars (する / くる).
 * Keyed on POS via the [Cond] bitmask. One source of truth with the deinflector —
 * guaranteed by ConjugatorTest's round-trip.
 */
object Conjugator {

    fun conjugate(dictForm: String, posMask: Int): ConjugationTable = when {
        (posMask and Cond.ADJ_I) != 0 -> adjI(dictForm)
        (posMask and Cond.VS) != 0 -> suru(dictForm)
        (posMask and Cond.VK) != 0 -> kuru(dictForm)
        (posMask and Cond.V1) != 0 -> ichidan(dictForm)
        (posMask and Cond.V5) != 0 -> godan(dictForm)
        else -> ConjugationTable(dictForm, emptyList())
    }

    private fun table(
        dictForm: String,
        informal: List<Conjugation>,
        formal: List<Conjugation>,
        other: List<Conjugation>,
    ) = ConjugationTable(
        dictForm,
        listOf(
            ConjugationGroup("informal", informal),
            ConjugationGroup("formal", formal),
            ConjugationGroup("other", other),
        ).filter { it.forms.isNotEmpty() },
    )

    private fun ichidan(d: String): ConjugationTable {
        val s = d.dropLast(1) // drop る
        return table(
            d,
            informal = listOf(
                Conjugation("plain", d),
                Conjugation("negative", s + "ない"),
                Conjugation("past", s + "た"),
                Conjugation("past negative", s + "なかった", reversible = false),
            ),
            formal = listOf(
                Conjugation("polite", s + "ます"),
                Conjugation("polite negative", s + "ません"),
                Conjugation("polite past", s + "ました"),
                Conjugation("polite volitional", s + "ましょう", reversible = false),
            ),
            other = listOf(
                Conjugation("te", s + "て"),
                Conjugation("conditional (tara)", s + "たら", reversible = false),
                Conjugation("conditional (ba)", s + "れば"),
                Conjugation("volitional", s + "よう"),
                Conjugation("potential", s + "られる"),
                Conjugation("passive", s + "られる"),
                Conjugation("causative", s + "させる"),
                Conjugation("causative-passive", s + "させられる"),
                Conjugation("imperative", s + "ろ"),
            ),
        )
    }

    private fun godan(d: String): ConjugationTable {
        val rows = JapaneseTransforms.GODAN_ROWS
        val pastTe = JapaneseTransforms.GODAN_PAST_TE
        val last = d.last().toString()
        val i = rows.indexOfFirst { it[0] == last }
        if (i < 0) return ConjugationTable(d, emptyList())
        val s = d.dropLast(1)
        val r = rows[i]
        val pt = pastTe[i]
        return table(
            d,
            informal = listOf(
                Conjugation("plain", d),
                Conjugation("negative", s + r[2] + "ない"),
                Conjugation("past", s + pt[0]),
                Conjugation("past negative", s + r[2] + "なかった", reversible = false),
            ),
            formal = listOf(
                Conjugation("polite", s + r[1] + "ます"),
                Conjugation("polite negative", s + r[1] + "ません"),
                Conjugation("polite past", s + r[1] + "ました"),
                Conjugation("polite volitional", s + r[1] + "ましょう", reversible = false),
            ),
            other = listOf(
                Conjugation("te", s + pt[2]),
                Conjugation("conditional (tara)", s + pt[0] + "ら", reversible = false),
                Conjugation("conditional (ba)", s + r[3] + "ば"),
                Conjugation("volitional", s + r[4] + "う"),
                Conjugation("potential", s + r[3] + "る"),
                Conjugation("passive", s + r[2] + "れる"),
                Conjugation("causative", s + r[2] + "せる"),
                Conjugation("causative-passive", s + r[2] + "せられる"),
                Conjugation("imperative", s + r[3]),
            ),
        )
    }

    private fun adjI(d: String): ConjugationTable {
        val s = d.dropLast(1) // drop い
        return table(
            d,
            informal = listOf(
                Conjugation("plain", d),
                Conjugation("negative", s + "くない"),
                Conjugation("past", s + "かった"),
                Conjugation("past negative", s + "くなかった", reversible = false),
            ),
            formal = emptyList(),
            other = listOf(
                Conjugation("te", s + "くて"),
                Conjugation("conditional (ba)", s + "ければ"),
                Conjugation("adverbial", s + "く", reversible = false),
            ),
        )
    }

    // -- Irregulars. Operate on the kana spellings the deinflector knows (くる/する),
    //    so 〜する / 〜くる compounds round-trip via the suffix rules too.
    private fun suru(d: String): ConjugationTable {
        val p = d.dropLast(2) // drop する
        return table(
            d,
            informal = listOf(
                Conjugation("plain", d),
                Conjugation("negative", p + "しない"),
                Conjugation("past", p + "した"),
                Conjugation("past negative", p + "しなかった", reversible = false),
            ),
            formal = listOf(
                Conjugation("polite", p + "します"),
                Conjugation("polite negative", p + "しません", reversible = false),
                Conjugation("polite past", p + "しました", reversible = false),
            ),
            other = listOf(
                Conjugation("te", p + "して"),
                Conjugation("potential", p + "できる"),
                Conjugation("volitional", p + "しよう"),
                Conjugation("conditional (ba)", p + "すれば"),
                Conjugation("passive", p + "される"),
                Conjugation("causative", p + "させる"),
                Conjugation("causative-passive", p + "させられる"),
                Conjugation("imperative", p + "しろ"),
            ),
        )
    }

    private fun kuru(d: String): ConjugationTable {
        val p = d.dropLast(2) // drop くる
        return table(
            d,
            informal = listOf(
                Conjugation("plain", d),
                Conjugation("negative", p + "こない"),
                Conjugation("past", p + "きた"),
                Conjugation("past negative", p + "こなかった", reversible = false),
            ),
            formal = listOf(
                Conjugation("polite", p + "きます"),
                Conjugation("polite negative", p + "きません", reversible = false),
                Conjugation("polite past", p + "きました", reversible = false),
            ),
            other = listOf(
                Conjugation("te", p + "きて"),
                Conjugation("potential", p + "こられる"),
                Conjugation("volitional", p + "こよう"),
                Conjugation("conditional (ba)", p + "くれば"),
                Conjugation("passive", p + "こられる"),
                Conjugation("causative", p + "こさせる"),
                Conjugation("causative-passive", p + "こさせられる"),
                Conjugation("imperative", p + "こい"),
            ),
        )
    }
}
