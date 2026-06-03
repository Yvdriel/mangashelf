package com.mangashelf.dict.engine

/**
 * Verb / adjective class bitfield. Bits track which classes a candidate form can
 * inhabit during deinflection BFS. Faithful port of
 * src/lib/dict/transforms/conditions.ts (Yomitan-modeled). Plain `val` (not const):
 * `shl`/`or` are infix functions, not const expressions in Kotlin.
 */
object Cond {
    val V1 = 1 shl 0      // ichidan (る-verbs ending える/いる) + stems
    val V5 = 1 shl 1      // godan (う-verbs)
    val VK = 1 shl 2      // 来る
    val VS = 1 shl 3      // する / -する
    val VZ = 1 shl 4      // ずる (rare)
    val ADJ_I = 1 shl 5
    val IRU = 1 shl 6     // -て + いる auxiliary
    val ANY_VERB = V1 or V5 or VK or VS or VZ
    val ANY = ANY_VERB or ADJ_I or IRU
}

/**
 * Map Yomitan term-bank `rules` tags into the bitfield. Empty rules → ANY (the
 * word isn't conjugatable; only the zero-deinflection candidate can hit it).
 */
fun rulesToConditions(rules: List<String>): Int {
    if (rules.isEmpty()) return Cond.ANY
    var mask = 0
    for (r in rules) {
        mask = mask or when (r) {
            "v1", "v1d", "v1p" -> Cond.V1
            "v5", "v5d" -> Cond.V5
            "vk" -> Cond.VK
            "vs" -> Cond.VS
            "vz" -> Cond.VZ
            "adj-i" -> Cond.ADJ_I
            "iru" -> Cond.IRU
            else -> Cond.ANY
        }
    }
    return if (mask != 0) mask else Cond.ANY
}
