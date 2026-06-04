package com.mangashelf.reader.data.reader

/**
 * `BitmapFactory.inSampleSize` math — the primary heap bound for the reader. Returns the largest
 * power-of-2 `s` such that `srcW / s >= targetW`, clamped to 1 (never upscales, never below 1).
 *
 * Used for both the full page (source width vs the ~480px usable display) and a zoom region (region
 * width vs display), so the decoded bitmap is always ≈ display-sized regardless of source megapixels.
 */
object SampleSize {

    fun forWidth(srcW: Int, targetW: Int): Int {
        if (targetW <= 0 || srcW <= targetW) return 1
        var s = 1
        while (srcW / (s * 2) >= targetW) s *= 2
        return s
    }
}
