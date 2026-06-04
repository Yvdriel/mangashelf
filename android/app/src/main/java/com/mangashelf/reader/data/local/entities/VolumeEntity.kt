package com.mangashelf.reader.data.local.entities

import androidx.room.Entity
import androidx.room.Index

/**
 * A volume row. The natural key is `(mangaId, volumeNumber)` — the server's own volume id churns on
 * a library rescan, so it is kept as [serverVolumeId] (for archive/progress calls) but is not the
 * key. [pinned] is client-owned state (the 3.4 hinge for downloads/reader); it is preserved across
 * delta syncs by never overwriting it from the server payload.
 */
@Entity(
    tableName = "volume",
    primaryKeys = ["mangaId", "volumeNumber"],
    indices = [Index("mangaId")],
)
data class VolumeEntity(
    val mangaId: Int,
    val volumeNumber: Int,
    val serverVolumeId: Int,
    val folderName: String,
    val pageCount: Int,
    val pinned: Boolean = false,
)
