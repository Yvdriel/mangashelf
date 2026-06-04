package com.mangashelf.reader.data.repo

import com.mangashelf.reader.data.local.entities.MangaEntity
import com.mangashelf.reader.data.local.entities.VolumeEntity
import com.mangashelf.reader.data.remote.dto.MangaDto

/**
 * Pure DTO→entity mapping (no Android deps, JVM-testable). The volume's server id becomes
 * [VolumeEntity.serverVolumeId]; the natural key is `(mangaId, volumeNumber)`. `pinned` is omitted
 * here (defaults false) — the repository preserves any existing pin on upsert.
 */
object LibraryMapper {

    fun toMangaEntities(dtos: List<MangaDto>): List<MangaEntity> = dtos.map { m ->
        MangaEntity(
            id = m.id,
            anilistId = m.anilistId,
            title = m.title,
            folderName = m.folderName,
            coverImage = m.coverImage,
            totalVolumes = m.totalVolumes,
            updatedAt = m.updatedAt,
        )
    }

    fun toVolumeEntities(dtos: List<MangaDto>): List<VolumeEntity> = dtos.flatMap { m ->
        m.volumes.map { v ->
            VolumeEntity(
                mangaId = m.id,
                volumeNumber = v.volumeNumber,
                serverVolumeId = v.id,
                folderName = v.folderName,
                pageCount = v.pageCount,
            )
        }
    }
}
