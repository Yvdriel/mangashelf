package com.mangashelf.reader.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.mangashelf.reader.data.local.entities.VolumeEntity

@Dao
interface VolumeDao {

    /**
     * Adds volumes that don't exist yet (pinned defaults false). Existing rows are left untouched so
     * the client-owned [VolumeEntity.pinned] survives — server fields are refreshed separately via
     * [updateServerFields].
     */
    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insertIgnore(volumes: List<VolumeEntity>)

    @Query(
        "UPDATE volume SET serverVolumeId = :serverVolumeId, folderName = :folderName, " +
            "pageCount = :pageCount WHERE mangaId = :mangaId AND volumeNumber = :volumeNumber",
    )
    suspend fun updateServerFields(
        mangaId: Int,
        volumeNumber: Int,
        serverVolumeId: Int,
        folderName: String,
        pageCount: Int,
    )

    @Query("UPDATE volume SET pinned = :pinned WHERE mangaId = :mangaId AND volumeNumber = :volumeNumber")
    suspend fun setPinned(mangaId: Int, volumeNumber: Int, pinned: Boolean)

    /** Maps the server's churning `volumeId` back to the client-stable volumeNumber (CH.8/5.4 pull). */
    @Query("SELECT volumeNumber FROM volume WHERE mangaId = :mangaId AND serverVolumeId = :serverVolumeId LIMIT 1")
    suspend fun findVolumeNumber(mangaId: Int, serverVolumeId: Int): Int?

    @Query("UPDATE volume SET pinned = 0")
    suspend fun unpinAll()

    @Query("DELETE FROM volume")
    suspend fun clearVolumes()
}
