package com.mangashelf.reader.data.local.entities

import androidx.room.Entity

/**
 * Local reading position for a volume (CH.7 4.2). Natural key `(mangaId, volumeNumber)` matches the
 * library tables. `clientUpdatedAt` is set on every local write; `syncedUpdatedAt` stays null until
 * CH.8/5.3 pushes the position to the server (last-write-wins). The reader never writes it here.
 */
@Entity(tableName = "progress", primaryKeys = ["mangaId", "volumeNumber"])
data class ProgressEntity(
    val mangaId: Int,
    val volumeNumber: Int,
    val currentPage: Int,
    val clientUpdatedAt: Long,
    val syncedUpdatedAt: Long? = null,
)
