package com.mangashelf.reader.data.remote.dto

import kotlinx.serialization.Serializable

/**
 * Response of `GET /api/v1/library[?changedSince=<unixSec>]`. [serverTime] is unix **seconds** and
 * becomes the next `changedSince`. When `changedSince` is set the server omits unchanged manga, so
 * [manga] is a delta, not a full snapshot.
 */
@Serializable
data class LibraryResponseDto(
    val serverTime: Long,
    val manga: List<MangaDto> = emptyList(),
)

@Serializable
data class MangaDto(
    val id: Int,
    val anilistId: Int? = null,
    val title: String,
    val folderName: String,
    val coverImage: String? = null,
    val totalVolumes: Int = 0,
    /** Unix seconds; the most recent change to this manga (manga-level delta granularity). */
    val updatedAt: Long,
    val volumes: List<VolumeDto> = emptyList(),
)

@Serializable
data class VolumeDto(
    /** Server volume id — can churn on a library rescan, so it is not the client's natural key. */
    val id: Int,
    val volumeNumber: Int,
    val folderName: String,
    val pageCount: Int = 0,
)
