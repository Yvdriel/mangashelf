package com.mangashelf.reader.data.local

import androidx.room.Dao
import androidx.room.Query
import androidx.room.Upsert
import com.mangashelf.reader.data.local.entities.ProgressEntity
import kotlinx.coroutines.flow.Flow

/** Local-only reading-position access (CH.7 4.2). Server push is CH.8/5.3. */
@Dao
interface ProgressDao {

    @Upsert
    suspend fun upsert(progress: ProgressEntity)

    @Query("SELECT * FROM progress WHERE mangaId = :mangaId AND volumeNumber = :volumeNumber")
    fun observe(mangaId: Int, volumeNumber: Int): Flow<ProgressEntity?>

    @Query("SELECT * FROM progress WHERE mangaId = :mangaId AND volumeNumber = :volumeNumber")
    suspend fun get(mangaId: Int, volumeNumber: Int): ProgressEntity?

    /**
     * Dirty rows (never synced, or written since the last sync) joined to their volume's
     * `serverVolumeId` for the push (CH.8/5.3). Rows without a known volume are excluded — the server
     * keys on `volumeId`, so a progress row we can't address is skipped until the library catches up.
     */
    @Query(
        "SELECT p.mangaId AS mangaId, p.volumeNumber AS volumeNumber, v.serverVolumeId AS serverVolumeId, " +
            "p.currentPage AS currentPage, p.clientUpdatedAt AS clientUpdatedAt " +
            "FROM progress p JOIN volume v ON p.mangaId = v.mangaId AND p.volumeNumber = v.volumeNumber " +
            "WHERE p.syncedUpdatedAt IS NULL OR p.syncedUpdatedAt < p.clientUpdatedAt",
    )
    suspend fun selectDirty(): List<DirtyProgressRow>

    @Query("UPDATE progress SET syncedUpdatedAt = :syncedUpdatedAt WHERE mangaId = :mangaId AND volumeNumber = :volumeNumber")
    suspend fun markSynced(mangaId: Int, volumeNumber: Int, syncedUpdatedAt: Long)

    @Query("DELETE FROM progress")
    suspend fun clearProgress()
}
