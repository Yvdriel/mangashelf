package com.mangashelf.reader.data.remote.dto

import kotlinx.serialization.Serializable

/** `POST /api/v1/progress/batch` (CH.3 1.4). The server keys on `volumeId`; timestamps are unix seconds. */
@Serializable
data class ProgressBatchRequestDto(val entries: List<ProgressBatchEntryDto>)

@Serializable
data class ProgressBatchEntryDto(
    val mangaId: Int,
    val volumeId: Int,
    val currentPage: Int,
    val clientUpdatedAt: Long,
    val isCompleted: Boolean? = null,
)

@Serializable
data class ProgressBatchResultDto(
    val accepted: List<ProgressRefDto> = emptyList(),
    val rejected: List<ProgressRejectionDto> = emptyList(),
)

@Serializable
data class ProgressRefDto(val mangaId: Int, val volumeId: Int)

@Serializable
data class ProgressRejectionDto(val mangaId: Int, val volumeId: Int, val reason: String? = null)

/** `GET /api/v1/progress?changedSince=` (CH.3 1.4). `updatedAt` is unix seconds. */
@Serializable
data class ProgressPullResponseDto(
    val serverTime: Long,
    val progress: List<ServerProgressDto> = emptyList(),
)

@Serializable
data class ServerProgressDto(
    val mangaId: Int,
    val volumeId: Int,
    val currentPage: Int,
    val isCompleted: Boolean = false,
    val updatedAt: Long,
)
