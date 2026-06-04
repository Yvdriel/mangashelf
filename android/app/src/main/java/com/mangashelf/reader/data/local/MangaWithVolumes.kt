package com.mangashelf.reader.data.local

import androidx.room.Embedded
import androidx.room.Relation
import com.mangashelf.reader.data.local.entities.MangaEntity
import com.mangashelf.reader.data.local.entities.VolumeEntity

/** A manga with its volumes — the unit the library and detail screens observe. */
data class MangaWithVolumes(
    @Embedded val manga: MangaEntity,
    @Relation(parentColumn = "id", entityColumn = "mangaId")
    val volumes: List<VolumeEntity>,
)
