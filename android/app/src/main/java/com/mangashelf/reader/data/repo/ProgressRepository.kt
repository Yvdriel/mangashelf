package com.mangashelf.reader.data.repo

import com.mangashelf.reader.data.local.ProgressDao
import com.mangashelf.reader.data.local.entities.ProgressEntity
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Local-only reading-position writes (CH.7 4.2). Every [write] stamps `clientUpdatedAt` and leaves
 * `syncedUpdatedAt` null — CH.8/5.3 owns the server push and the last-write-wins reconciliation.
 */
@Singleton
class ProgressRepository @Inject constructor(
    private val dao: ProgressDao,
) {

    fun observe(mangaId: Int, volumeNumber: Int): Flow<ProgressEntity?> =
        dao.observe(mangaId, volumeNumber)

    /** Resume page for a volume, or 0 if none recorded yet. */
    suspend fun resumePage(mangaId: Int, volumeNumber: Int): Int =
        dao.get(mangaId, volumeNumber)?.currentPage ?: 0

    suspend fun write(
        mangaId: Int,
        volumeNumber: Int,
        page: Int,
        now: Long = System.currentTimeMillis(),
    ) = dao.upsert(
        ProgressEntity(
            mangaId = mangaId,
            volumeNumber = volumeNumber,
            currentPage = page,
            clientUpdatedAt = now,
            syncedUpdatedAt = null,
        ),
    )
}
