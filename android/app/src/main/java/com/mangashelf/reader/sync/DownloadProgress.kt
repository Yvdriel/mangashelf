package com.mangashelf.reader.sync

/** Bytes→percent for download progress. Returns -1 when the total length is unknown. */
object DownloadProgress {

    const val INDETERMINATE = -1

    fun percent(bytesRead: Long, totalBytes: Long): Int {
        if (totalBytes <= 0L) return INDETERMINATE
        return (bytesRead * 100L / totalBytes).coerceIn(0L, 100L).toInt()
    }
}
