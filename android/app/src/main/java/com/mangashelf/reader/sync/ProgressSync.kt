package com.mangashelf.reader.sync

import com.mangashelf.reader.data.local.DirtyProgressRow
import com.mangashelf.reader.data.remote.dto.ProgressBatchEntryDto
import com.mangashelf.reader.data.remote.dto.ProgressBatchRequestDto
import com.mangashelf.reader.data.remote.dto.ProgressBatchResultDto

/**
 * Pure push-side reconciliation (CH.8/5.3), JVM-testable without a device:
 *  - [toBatchRequest] maps dirty local rows to the server's `volumeId` shape and millis→seconds;
 *  - [marks] decides which local rows to clear the dirty flag on after a 200. Accepted AND rejected
 *    both clear (rejected = stale → no retry); the synced timestamp is the *pushed* clientUpdatedAt
 *    so a write that landed after the push still reads dirty next time.
 */
object ProgressSync {

    fun toBatchRequest(dirty: List<DirtyProgressRow>): ProgressBatchRequestDto =
        ProgressBatchRequestDto(
            dirty.map {
                ProgressBatchEntryDto(
                    mangaId = it.mangaId,
                    volumeId = it.serverVolumeId,
                    currentPage = it.currentPage,
                    clientUpdatedAt = it.clientUpdatedAt / 1000, // millis → unix seconds
                )
            },
        )

    data class SyncMark(val mangaId: Int, val volumeNumber: Int, val syncedUpdatedAt: Long)

    fun marks(dirty: List<DirtyProgressRow>, result: ProgressBatchResultDto): List<SyncMark> {
        val acknowledged = buildSet {
            result.accepted.forEach { add(it.mangaId to it.volumeId) }
            result.rejected.forEach { add(it.mangaId to it.volumeId) }
        }
        return dirty
            .filter { (it.mangaId to it.serverVolumeId) in acknowledged }
            .map { SyncMark(it.mangaId, it.volumeNumber, it.clientUpdatedAt) }
    }
}
