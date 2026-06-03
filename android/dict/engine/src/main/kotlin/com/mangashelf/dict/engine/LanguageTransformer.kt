package com.mangashelf.dict.engine

/** A deinflected candidate: the reduced [term], the [reasons] chain that produced
 *  it, and the verb/adjective [conditions] bitmask it is valid for. */
data class DeinflectedForm(
    val term: String,
    val reasons: List<String>,
    val conditions: Int,
)

/** A single suffix-substitution rule. [kanaIn] must match the tail of the source
 *  term and is replaced by [kanaOut]. [conditionsIn] is intersected with the
 *  candidate's running conditions to decide applicability; [conditionsOut] becomes
 *  the new candidate's conditions. `kanaIn == ""` matches every term. */
data class SuffixRule(
    val reason: String,
    val kanaIn: String,
    val kanaOut: String,
    val conditionsIn: Int,
    val conditionsOut: Int,
)

/**
 * Breadth-first deinflection. Faithful port of
 * src/lib/dict/transforms/language-transformer.ts — pure string + Int ops, no deps.
 */
class LanguageTransformer(private val rules: List<SuffixRule>) {

    fun transform(text: String, anyMask: Int): List<DeinflectedForm> {
        val out = ArrayList<DeinflectedForm>()
        out.add(DeinflectedForm(text, emptyList(), anyMask))
        val seen = HashSet<String>()
        seen.add(key(text, anyMask))

        var depth = 0
        var prevLen = 0
        while (depth < MAX_DEPTH && out.size > prevLen) {
            val upper = out.size
            for (i in prevLen until upper) {
                val cand = out[i]
                for (rule in rules) {
                    if ((cand.conditions and rule.conditionsIn) == 0) continue
                    val tail = rule.kanaIn
                    if (tail.length > cand.term.length) continue
                    if (tail.isNotEmpty() && !cand.term.endsWith(tail)) continue
                    val newTerm = cand.term.substring(0, cand.term.length - tail.length) + rule.kanaOut
                    if (newTerm.isEmpty()) continue
                    val k = key(newTerm, rule.conditionsOut)
                    if (!seen.add(k)) continue
                    out.add(DeinflectedForm(newTerm, cand.reasons + rule.reason, rule.conditionsOut))
                }
            }
            prevLen = upper
            depth++
        }
        return out
    }

    private companion object {
        const val MAX_DEPTH = 8
        fun key(term: String, conditions: Int): String = "$term|$conditions"
    }
}
