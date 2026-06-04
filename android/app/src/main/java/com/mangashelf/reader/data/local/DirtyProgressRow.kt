package com.mangashelf.reader.data.local

/**
 * A dirty local progress row joined to its volume's [serverVolumeId] — the projection the sync push
 * (CH.8/5.3) needs to address the server (which keys progress by `volumeId`). `clientUpdatedAt` stays
 * in millis here; [com.mangashelf.reader.sync.ProgressSync] converts to seconds at the network edge.
 */
data class DirtyProgressRow(
    val mangaId: Int,
    val volumeNumber: Int,
    val serverVolumeId: Int,
    val currentPage: Int,
    val clientUpdatedAt: Long,
)
