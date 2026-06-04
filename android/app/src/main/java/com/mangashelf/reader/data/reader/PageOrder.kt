package com.mangashelf.reader.data.reader

/**
 * Natural-order comparator for CBZ page entry names. Splits each name into alternating digit /
 * non-digit runs and compares run-by-run so `2.jpg` sorts before `10.jpg` and `001.jpg` before
 * `010.jpg`. Numeric runs compare as numbers (length-then-lexicographic on the zero-stripped digits,
 * overflow-free); a numeric run sorts before a non-numeric one. Shared watermark/prefix text
 * (`DLRAW.TO_001.jpg`) collapses to the trailing number.
 */
object PageOrder {

    val comparator: Comparator<String> = Comparator { a, b ->
        val ca = runs(a)
        val cb = runs(b)
        val shared = minOf(ca.size, cb.size)
        for (i in 0 until shared) {
            val x = ca[i]
            val y = cb[i]
            val cmp = compareRun(x, y)
            if (cmp != 0) return@Comparator cmp
        }
        ca.size - cb.size
    }

    private fun compareRun(x: String, y: String): Int {
        val xNum = x[0].isDigit()
        val yNum = y[0].isDigit()
        return when {
            xNum && yNum -> {
                val xs = x.trimStart('0').ifEmpty { "0" }
                val ys = y.trimStart('0').ifEmpty { "0" }
                if (xs.length != ys.length) xs.length - ys.length else xs.compareTo(ys)
            }
            xNum -> -1 // numbers before strings
            yNum -> 1
            else -> x.compareTo(y)
        }
    }

    private fun runs(s: String): List<String> {
        val out = ArrayList<String>()
        var i = 0
        while (i < s.length) {
            val digit = s[i].isDigit()
            val start = i
            while (i < s.length && s[i].isDigit() == digit) i++
            out.add(s.substring(start, i))
        }
        return out
    }
}
