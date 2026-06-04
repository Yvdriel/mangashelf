package com.mangashelf.reader.data.local.entities

import androidx.room.Entity

/** Lifecycle of a pinned volume's download (CH.8/5.1). Stored as TEXT (the enum name). */
enum class DownloadState {
    /** Enqueued, worker not yet running (offline or waiting for a slot). */
    QUEUED,

    /** Streaming bytes to disk. */
    DOWNLOADING,

    /** CBZ present + valid at the archive path. */
    DOWNLOADED,

    /** Terminal failure (4xx, corrupt zip, out of space). Retryable from DownloadsScreen. */
    FAILED,
}

/**
 * Durable download state for a pinned volume (CH.8/5.1), keyed by the client-natural
 * `(mangaId, volumeNumber)` like the rest of the library. WorkManager carries live byte progress via
 * `WorkInfo.progress`; this table is the source of truth for queued/failed rows that outlive a
 * `WorkInfo` and for what DownloadsScreen renders. Removed when the volume is unpinned.
 */
@Entity(tableName = "download_queue", primaryKeys = ["mangaId", "volumeNumber"])
data class DownloadEntity(
    val mangaId: Int,
    val volumeNumber: Int,
    val state: DownloadState,
    val bytesDownloaded: Long = 0,
    val totalBytes: Long = 0,
    val errorMessage: String? = null,
    val updatedAt: Long,
)
