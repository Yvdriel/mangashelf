package com.mangashelf.reader.data.reader

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.BitmapRegionDecoder
import android.graphics.Rect
import android.util.Size
import java.io.Closeable
import java.io.File
import java.util.zip.ZipFile

/**
 * Decodes pages of a CBZ (zip of images) on demand. Two heap-bounding mechanisms:
 *  - full pages are decoded with [SampleSize]-tuned `inSampleSize` so a multi-megapixel scan becomes
 *    a ≈display-width bitmap (~1 MB), held in a 3-entry [BitmapLru] that recycles on eviction;
 *  - [decodeRegion] reads a full-resolution sub-rect (for 4.3 zoom / O.3 OCR crop), also sampled to
 *    ≈display width, and the caller recycles it on move/exit — only ever one region bitmap alive.
 *
 * Not thread-safe; the ViewModel confines calls to a single decode dispatcher.
 */
class PageSource(file: File, private val targetWidthPx: Int) : Closeable {

    private val zip = ZipFile(file)
    private val entryNames: List<String> =
        CbzIndex.imageEntryNames(zip.entries().toList().map { it.name })

    private val cache = BitmapLru<Bitmap>(maxSize = 3) { if (!it.isRecycled) it.recycle() }

    val pageCount: Int get() = entryNames.size

    /** The CBZ entry name (with any folder prefix) at [index] — for mapping pages to mokuro by file. */
    fun entryName(index: Int): String = entryNames[index]

    /** Source pixel dimensions of [index] (decode-bounds only, no allocation) — for zoom grid math. */
    fun pageBounds(index: Int): Size {
        val opts = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        val bytes = readEntry(index)
        BitmapFactory.decodeByteArray(bytes, 0, bytes.size, opts)
        return Size(opts.outWidth, opts.outHeight)
    }

    /** Full page, sampled to ≈[targetWidthPx]. Cached; eviction recycles. */
    fun page(index: Int): Bitmap {
        cache.get(index)?.takeIf { !it.isRecycled }?.let { return it }
        val bytes = readEntry(index)
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
        val opts = BitmapFactory.Options().apply {
            inSampleSize = SampleSize.forWidth(bounds.outWidth, targetWidthPx)
        }
        val bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size, opts)
            ?: error("decode failed for page $index (${entryNames[index]})")
        cache.put(index, bitmap)
        return bitmap
    }

    /** Full-resolution sub-region of [index], sampled to ≈[targetWidthPx]. Caller owns/recycles it. */
    fun decodeRegion(index: Int, srcRect: Rect, targetWidthPx: Int = this.targetWidthPx): Bitmap {
        val bytes = readEntry(index)
        @Suppress("DEPRECATION") // newInstance(byte[]) without the boolean is API 31+; minSdk is 28.
        val decoder = BitmapRegionDecoder.newInstance(bytes, 0, bytes.size, false)
            ?: error("region decoder unavailable for page $index")
        try {
            val opts = BitmapFactory.Options().apply {
                inSampleSize = SampleSize.forWidth(srcRect.width(), targetWidthPx)
            }
            return decoder.decodeRegion(srcRect, opts) ?: error("region decode failed for page $index")
        } finally {
            decoder.recycle()
        }
    }

    /** Visible for tests: number of pages currently resident in the LRU. */
    fun cachedCount(): Int = cache.size()

    private fun readEntry(index: Int): ByteArray {
        val entry = zip.getEntry(entryNames[index]) ?: error("missing entry ${entryNames[index]}")
        return zip.getInputStream(entry).use { it.readBytes() }
    }

    override fun close() {
        cache.clear()
        zip.close()
    }
}
