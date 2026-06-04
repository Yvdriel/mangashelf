package com.mangashelf.reader.data.local

import androidx.room.Dao
import androidx.room.Query
import androidx.room.Transaction
import androidx.room.Upsert
import com.mangashelf.reader.data.local.entities.MangaEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface MangaDao {

    @Upsert
    suspend fun upsertManga(manga: List<MangaEntity>)

    @Transaction
    @Query("SELECT * FROM manga ORDER BY title COLLATE NOCASE")
    fun observeLibrary(): Flow<List<MangaWithVolumes>>

    @Transaction
    @Query("SELECT * FROM manga WHERE id = :id")
    fun observeManga(id: Int): Flow<MangaWithVolumes?>

    @Query("DELETE FROM manga")
    suspend fun clearManga()
}
