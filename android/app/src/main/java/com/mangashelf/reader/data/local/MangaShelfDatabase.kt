package com.mangashelf.reader.data.local

import androidx.room.Database
import androidx.room.RoomDatabase
import androidx.room.TypeConverters
import com.mangashelf.reader.data.local.entities.DownloadEntity
import com.mangashelf.reader.data.local.entities.MangaEntity
import com.mangashelf.reader.data.local.entities.ProgressEntity
import com.mangashelf.reader.data.local.entities.VolumeEntity

/**
 * Reader-pillar local store. Schema JSON is exported to `app/schemas/`.
 *  - v1 (CH.4): library cache — `manga`, `volume`.
 *  - v2 (CH.7 4.2): adds local reading position — `progress` (additive, see [MIGRATION_1_2]).
 *  - v3 (CH.8 5.1): adds the download queue — `download_queue` (additive, see [MIGRATION_2_3]).
 */
@Database(
    entities = [MangaEntity::class, VolumeEntity::class, ProgressEntity::class, DownloadEntity::class],
    version = 3,
    exportSchema = true,
)
@TypeConverters(DownloadConverters::class)
abstract class MangaShelfDatabase : RoomDatabase() {
    abstract fun mangaDao(): MangaDao
    abstract fun volumeDao(): VolumeDao
    abstract fun progressDao(): ProgressDao
    abstract fun downloadDao(): DownloadDao
}
