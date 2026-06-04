package com.mangashelf.reader.sync

import com.mangashelf.reader.data.local.entities.ProgressEntity

/** Outcome of reconciling one server progress row against the local row. */
sealed interface MergeOutcome {
    data class Overwrite(val entity: ProgressEntity) : MergeOutcome
    data object Keep : MergeOutcome
}

/**
 * Pure last-write-wins reconcile for the progress pull (CH.8/5.4). The server row wins only when
 * STRICTLY newer than the local write; a device-local change that hasn't been pushed yet (newer, or
 * equal timestamp) is preserved. Server time is unix seconds, local is millis — compared in millis.
 * A pulled row is written with `syncedUpdatedAt == clientUpdatedAt`, i.e. clean (not re-pushed).
 */
object ProgressMerge {

    fun reconcile(
        local: ProgressEntity?,
        mangaId: Int,
        volumeNumber: Int,
        serverCurrentPage: Int,
        serverUpdatedAtSeconds: Long,
    ): MergeOutcome {
        val serverMillis = serverUpdatedAtSeconds * 1000
        val localMillis = local?.clientUpdatedAt ?: Long.MIN_VALUE
        return if (serverMillis > localMillis) {
            MergeOutcome.Overwrite(
                ProgressEntity(
                    mangaId = mangaId,
                    volumeNumber = volumeNumber,
                    currentPage = serverCurrentPage,
                    clientUpdatedAt = serverMillis,
                    syncedUpdatedAt = serverMillis,
                ),
            )
        } else {
            MergeOutcome.Keep
        }
    }
}
