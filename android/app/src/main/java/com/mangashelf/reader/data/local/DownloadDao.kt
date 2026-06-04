package com.mangashelf.reader.data.local

import androidx.room.Dao
import androidx.room.Query
import androidx.room.Upsert
import com.mangashelf.reader.data.local.entities.DownloadEntity
import kotlinx.coroutines.flow.Flow

/** download_queue access (CH.8/5.1) — durable queued/failed state behind DownloadsScreen. */
@Dao
interface DownloadDao {

    @Upsert
    suspend fun upsert(download: DownloadEntity)

    /** Newest activity first — DownloadsScreen lists active/queued/failed together. */
    @Query("SELECT * FROM download_queue ORDER BY updatedAt DESC")
    fun observeAll(): Flow<List<DownloadEntity>>

    @Query("SELECT * FROM download_queue WHERE mangaId = :mangaId AND volumeNumber = :volumeNumber")
    suspend fun get(mangaId: Int, volumeNumber: Int): DownloadEntity?

    @Query("DELETE FROM download_queue WHERE mangaId = :mangaId AND volumeNumber = :volumeNumber")
    suspend fun delete(mangaId: Int, volumeNumber: Int)

    @Query("DELETE FROM download_queue")
    suspend fun clearAll()
}
