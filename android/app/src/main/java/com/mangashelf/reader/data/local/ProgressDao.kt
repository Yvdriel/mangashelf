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

    @Query("DELETE FROM progress")
    suspend fun clearProgress()
}
