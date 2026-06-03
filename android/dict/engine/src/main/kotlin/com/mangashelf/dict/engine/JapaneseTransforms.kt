package com.mangashelf.dict.engine

/**
 * Japanese deinflection rule table. Faithful port of
 * src/lib/dict/transforms/ja-transforms.ts — same GODAN_ROWS / GODAN_PAST_TE
 * generators run to build the rule set, so the deinflector and the forward
 * [conjugate] generator share ONE source of truth.
 */
object JapaneseTransforms {

    /** Godan kana rows, ordered [u, i, a, e, o] per consonant column.
     *  (negative uses the a-row; う-godan uses わ — encoded at index 2). */
    internal val GODAN_ROWS: List<List<String>> = listOf(
        listOf("う", "い", "わ", "え", "お"),
        listOf("く", "き", "か", "け", "こ"),
        listOf("ぐ", "ぎ", "が", "げ", "ご"),
        listOf("す", "し", "さ", "せ", "そ"),
        listOf("つ", "ち", "た", "て", "と"),
        listOf("ぬ", "に", "な", "ね", "の"),
        listOf("ぶ", "び", "ば", "べ", "ぼ"),
        listOf("む", "み", "ま", "め", "も"),
        listOf("る", "り", "ら", "れ", "ろ"),
    )

    /** Godan past/te by consonant column: [past-suffix, dict-suffix, te-suffix]. */
    internal val GODAN_PAST_TE: List<List<String>> = listOf(
        listOf("った", "う", "って"),
        listOf("いた", "く", "いて"),
        listOf("いだ", "ぐ", "いで"),
        listOf("した", "す", "して"),
        listOf("った", "つ", "って"),
        listOf("んだ", "ぬ", "んで"),
        listOf("んだ", "ぶ", "んで"),
        listOf("んだ", "む", "んで"),
        listOf("った", "る", "って"),
    )

    val rules: List<SuffixRule> = buildList {
        fun rule(reason: String, kanaIn: String, kanaOut: String, ci: Int, co: Int) =
            add(SuffixRule(reason, kanaIn, kanaOut, ci, co))

        // --- Past (-た / -だ) ---
        rule("past", "た", "る", Cond.ANY, Cond.V1)
        for (r in GODAN_PAST_TE) rule("past", r[0], r[1], Cond.ANY, Cond.V5)
        rule("past", "きた", "くる", Cond.ANY, Cond.VK)
        rule("past", "した", "する", Cond.ANY, Cond.VS)
        rule("-i past", "かった", "い", Cond.ANY, Cond.ADJ_I)

        // --- Te-form ---
        rule("-te", "て", "る", Cond.ANY, Cond.V1)
        for (r in GODAN_PAST_TE) rule("-te", r[2], r[1], Cond.ANY, Cond.V5)
        rule("-te", "きて", "くる", Cond.ANY, Cond.VK)
        rule("-te", "して", "する", Cond.ANY, Cond.VS)
        rule("-i te", "くて", "い", Cond.ANY, Cond.ADJ_I)

        // --- Negative (-ない) ---
        rule("negative", "ない", "る", Cond.ANY, Cond.V1)
        for (row in GODAN_ROWS) rule("negative", row[2] + "ない", row[0], Cond.ANY, Cond.V5)
        rule("negative", "こない", "くる", Cond.ANY, Cond.VK)
        rule("negative", "しない", "する", Cond.ANY, Cond.VS)
        rule("-i negative", "くない", "い", Cond.ANY, Cond.ADJ_I)

        // --- Polite -ます / -ません / -ました ---
        rule("polite", "ます", "る", Cond.ANY, Cond.V1)
        rule("polite", "ません", "る", Cond.ANY, Cond.V1)
        rule("polite past", "ました", "る", Cond.ANY, Cond.V1)
        for (row in GODAN_ROWS) {
            rule("polite", row[1] + "ます", row[0], Cond.ANY, Cond.V5)
            rule("polite", row[1] + "ません", row[0], Cond.ANY, Cond.V5)
            rule("polite past", row[1] + "ました", row[0], Cond.ANY, Cond.V5)
        }
        rule("polite", "きます", "くる", Cond.ANY, Cond.VK)
        rule("polite", "します", "する", Cond.ANY, Cond.VS)

        // --- Desiderative -たい ---
        rule("-tai", "たい", "る", Cond.ANY, Cond.V1)
        for (row in GODAN_ROWS) rule("-tai", row[1] + "たい", row[0], Cond.ANY, Cond.V5)
        rule("-tai", "きたい", "くる", Cond.ANY, Cond.VK)
        rule("-tai", "したい", "する", Cond.ANY, Cond.VS)

        // --- Causative -せる ---
        rule("causative", "させる", "る", Cond.ANY, Cond.V1)
        for (row in GODAN_ROWS) rule("causative", row[2] + "せる", row[0], Cond.ANY, Cond.V5)
        rule("causative", "こさせる", "くる", Cond.ANY, Cond.VK)
        rule("causative", "させる", "する", Cond.ANY, Cond.VS)

        // --- Passive -れる ---
        rule("passive", "られる", "る", Cond.ANY, Cond.V1)
        for (row in GODAN_ROWS) rule("passive", row[2] + "れる", row[0], Cond.ANY, Cond.V5)
        rule("passive", "こられる", "くる", Cond.ANY, Cond.VK)
        rule("passive", "される", "する", Cond.ANY, Cond.VS)

        // --- Causative-passive -せられる ---
        rule("causative-passive", "させられる", "る", Cond.ANY, Cond.V1)
        for (row in GODAN_ROWS) rule("causative-passive", row[2] + "せられる", row[0], Cond.ANY, Cond.V5)
        rule("causative-passive", "こさせられる", "くる", Cond.ANY, Cond.VK)
        rule("causative-passive", "させられる", "する", Cond.ANY, Cond.VS)

        // --- Potential -える / -られる ---
        rule("potential", "られる", "る", Cond.ANY, Cond.V1)
        for (row in GODAN_ROWS) rule("potential", row[3] + "る", row[0], Cond.ANY, Cond.V5)
        rule("potential", "こられる", "くる", Cond.ANY, Cond.VK)
        rule("potential", "できる", "する", Cond.ANY, Cond.VS)

        // --- Volitional -よう / -おう ---
        rule("volitional", "よう", "る", Cond.ANY, Cond.V1)
        for (row in GODAN_ROWS) rule("volitional", row[4] + "う", row[0], Cond.ANY, Cond.V5)
        rule("volitional", "こよう", "くる", Cond.ANY, Cond.VK)
        rule("volitional", "しよう", "する", Cond.ANY, Cond.VS)

        // --- Conditional -ば ---
        rule("conditional", "れば", "る", Cond.ANY, Cond.V1)
        for (row in GODAN_ROWS) rule("conditional", row[3] + "ば", row[0], Cond.ANY, Cond.V5)
        rule("conditional", "くれば", "くる", Cond.ANY, Cond.VK)
        rule("conditional", "すれば", "する", Cond.ANY, Cond.VS)
        rule("-i conditional", "ければ", "い", Cond.ANY, Cond.ADJ_I)

        // --- Imperative ---
        rule("imperative", "ろ", "る", Cond.ANY, Cond.V1)
        rule("imperative", "よ", "る", Cond.ANY, Cond.V1)
        for (row in GODAN_ROWS) rule("imperative", row[3], row[0], Cond.ANY, Cond.V5)
        rule("imperative", "こい", "くる", Cond.ANY, Cond.VK)
        rule("imperative", "しろ", "する", Cond.ANY, Cond.VS)
        rule("imperative", "せよ", "する", Cond.ANY, Cond.VS)

        // --- Auxiliary しまう (completion/regret) → reduce to underlying te-form ---
        rule("auxiliary -てしまう", "てしまう", "て", Cond.ANY, Cond.ANY)
        rule("auxiliary -でしまう", "でしまう", "で", Cond.ANY, Cond.ANY)
        rule("auxiliary -ちゃう", "ちゃう", "て", Cond.ANY, Cond.ANY)
        rule("auxiliary -じゃう", "じゃう", "で", Cond.ANY, Cond.ANY)

        // --- Progressive / state -ている (+ contracted -てる) ---
        rule("progressive", "ている", "て", Cond.ANY, Cond.ANY)
        rule("progressive", "でいる", "で", Cond.ANY, Cond.ANY)
        rule("progressive", "てる", "て", Cond.ANY, Cond.ANY)
        rule("progressive", "でる", "で", Cond.ANY, Cond.ANY)
    }
}
