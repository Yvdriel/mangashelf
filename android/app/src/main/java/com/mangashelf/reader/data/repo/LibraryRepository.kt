package com.mangashelf.reader.data.repo

import androidx.room.withTransaction
import com.mangashelf.reader.data.local.MangaDao
import com.mangashelf.reader.data.local.MangaShelfDatabase
import com.mangashelf.reader.data.local.MangaWithVolumes
import com.mangashelf.reader.data.local.VolumeDao
import com.mangashelf.reader.data.remote.dto.LibraryResponseDto
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject
import javax.inject.Singleton

/**
 * The library's single source of truth: the screens observe Room, the worker writes deltas into it.
 *
 * [applyDelta] upserts manga, then for each volume inserts-if-new and refreshes the server-owned
 * fields, deliberately leaving [com.mangashelf.reader.data.local.entities.VolumeEntity.pinned]
 * untouched so a sync never clears the user's pins. All writes run in one transaction.
 */
@Singleton
class LibraryRepository @Inject constructor(
    private val db: MangaShelfDatabase,
    private val mangaDao: MangaDao,
    private val volumeDao: VolumeDao,
) {

    fun observeLibrary(): Flow<List<MangaWithVolumes>> = mangaDao.observeLibrary()

    fun observeManga(id: Int): Flow<MangaWithVolumes?> = mangaDao.observeManga(id)

    suspend fun applyDelta(response: LibraryResponseDto) {
        if (response.manga.isEmpty()) return // delta no-op
        db.withTransaction {
            mangaDao.upsertManga(LibraryMapper.toMangaEntities(response.manga))
            val volumes = LibraryMapper.toVolumeEntities(response.manga)
            volumeDao.insertIgnore(volumes)
            volumes.forEach {
                volumeDao.updateServerFields(
                    mangaId = it.mangaId,
                    volumeNumber = it.volumeNumber,
                    serverVolumeId = it.serverVolumeId,
                    folderName = it.folderName,
                    pageCount = it.pageCount,
                )
            }
        }
    }

    suspend fun setPinned(mangaId: Int, volumeNumber: Int, pinned: Boolean) =
        volumeDao.setPinned(mangaId, volumeNumber, pinned)
}
