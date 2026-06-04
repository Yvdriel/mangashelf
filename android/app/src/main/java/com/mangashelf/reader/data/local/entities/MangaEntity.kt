package com.mangashelf.reader.data.local.entities

import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * A manga row mirrored from `/api/v1/library`. Keyed by the server [id] (used to build cover URLs).
 * [updatedAt] is unix seconds and drives delta sync (manga-level granularity).
 */
@Entity(tableName = "manga")
data class MangaEntity(
    @PrimaryKey val id: Int,
    val anilistId: Int?,
    val title: String,
    val folderName: String,
    val coverImage: String?,
    val totalVolumes: Int,
    val updatedAt: Long,
)
