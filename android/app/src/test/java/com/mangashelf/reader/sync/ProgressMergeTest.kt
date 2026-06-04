package com.mangashelf.reader.sync

import com.mangashelf.reader.data.local.entities.ProgressEntity
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * CH.8/5.4 TDD ANCHOR — last-write-wins reconcile, both directions. Server `updatedAt` is unix
 * seconds; local `clientUpdatedAt` is millis. The server row wins only when STRICTLY newer; a
 * device-local write (newer, or equal) is never clobbered.
 */
class ProgressMergeTest {

    private fun local(page: Int, clientUpdatedAtMillis: Long, synced: Long? = clientUpdatedAtMillis) =
        ProgressEntity(mangaId = 1, volumeNumber = 2, currentPage = page, clientUpdatedAt = clientUpdatedAtMillis, syncedUpdatedAt = synced)

    @Test
    fun serverNewer_overwritesLocal_andIsNotDirty() {
        // local @1000ms; server @2s == 2000ms → server wins.
        val outcome = ProgressMerge.reconcile(local(page = 3, clientUpdatedAtMillis = 1_000), 1, 2, serverCurrentPage = 40, serverUpdatedAtSeconds = 2)
        assertTrue(outcome is MergeOutcome.Overwrite)
        val e = (outcome as MergeOutcome.Overwrite).entity
        assertEquals(40, e.currentPage)
        assertEquals(2_000L, e.clientUpdatedAt)
        assertEquals("a pulled row is already synced (not dirty)", 2_000L, e.syncedUpdatedAt)
    }

    @Test
    fun deviceLocalNewer_isNotOverwritten() {
        // local @5000ms; server @2s == 2000ms → keep local.
        val outcome = ProgressMerge.reconcile(local(page = 9, clientUpdatedAtMillis = 5_000), 1, 2, serverCurrentPage = 1, serverUpdatedAtSeconds = 2)
        assertEquals(MergeOutcome.Keep, outcome)
    }

    @Test
    fun equalTimestamps_keepLocal_serverNotStrictlyNewer() {
        // local @2000ms; server @2s == 2000ms → not strictly newer → keep.
        val outcome = ProgressMerge.reconcile(local(page = 5, clientUpdatedAtMillis = 2_000), 1, 2, serverCurrentPage = 7, serverUpdatedAtSeconds = 2)
        assertEquals(MergeOutcome.Keep, outcome)
    }

    @Test
    fun noLocalRow_takesServer() {
        val outcome = ProgressMerge.reconcile(null, 1, 2, serverCurrentPage = 12, serverUpdatedAtSeconds = 9)
        assertTrue(outcome is MergeOutcome.Overwrite)
        assertEquals(12, (outcome as MergeOutcome.Overwrite).entity.currentPage)
    }
}
