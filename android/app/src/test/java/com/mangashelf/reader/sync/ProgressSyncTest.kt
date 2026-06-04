package com.mangashelf.reader.sync

import com.mangashelf.reader.data.local.DirtyProgressRow
import com.mangashelf.reader.data.remote.dto.ProgressBatchResultDto
import com.mangashelf.reader.data.remote.dto.ProgressRefDto
import com.mangashelf.reader.data.remote.dto.ProgressRejectionDto
import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * CH.8/5.3 pure logic: build the push batch (client `(mangaId, volumeNumber)` → server `volumeId`,
 * millis→seconds) and decide which local rows to mark synced. Both accepted AND rejected entries
 * clear the dirty flag (rejected = stale, no retry); an unacknowledged entry stays dirty.
 */
class ProgressSyncTest {

    private val dirty = listOf(
        // clientUpdatedAt in millis; server wants seconds.
        DirtyProgressRow(mangaId = 1, volumeNumber = 2, serverVolumeId = 77, currentPage = 9, clientUpdatedAt = 1_700_000_000_000),
        DirtyProgressRow(mangaId = 1, volumeNumber = 3, serverVolumeId = 78, currentPage = 0, clientUpdatedAt = 1_700_000_500_000),
    )

    @Test
    fun toBatchRequest_mapsToServerVolumeId_andSeconds() {
        val req = ProgressSync.toBatchRequest(dirty)
        assertEquals(2, req.entries.size)
        val first = req.entries[0]
        assertEquals(77, first.volumeId)
        assertEquals(9, first.currentPage)
        assertEquals(1_700_000_000L, first.clientUpdatedAt) // millis → seconds
    }

    @Test
    fun marks_clearDirtyForAccepted_andRejected_keepingClientTimestamp() {
        val result = ProgressBatchResultDto(
            accepted = listOf(ProgressRefDto(mangaId = 1, volumeId = 77)),
            rejected = listOf(ProgressRejectionDto(mangaId = 1, volumeId = 78, reason = "stale")),
        )
        val marks = ProgressSync.marks(dirty, result)
        assertEquals(2, marks.size)
        // synced timestamp == the pushed clientUpdatedAt (millis), so a later write stays dirty.
        assertEquals(
            setOf(
                ProgressSync.SyncMark(1, 2, 1_700_000_000_000),
                ProgressSync.SyncMark(1, 3, 1_700_000_500_000),
            ),
            marks.toSet(),
        )
    }

    @Test
    fun marks_skipUnacknowledgedEntries() {
        val result = ProgressBatchResultDto(
            accepted = listOf(ProgressRefDto(mangaId = 1, volumeId = 77)),
            rejected = emptyList(),
        )
        val marks = ProgressSync.marks(dirty, result)
        assertEquals(listOf(ProgressSync.SyncMark(1, 2, 1_700_000_000_000)), marks)
    }
}
