package com.mangashelf.reader.data.local

import androidx.room.Database
import androidx.room.RoomDatabase
import com.mangashelf.reader.data.local.entities.MangaEntity
import com.mangashelf.reader.data.local.entities.ProgressEntity
import com.mangashelf.reader.data.local.entities.VolumeEntity

/**
 * Reader-pillar local store. Schema JSON is exported to `app/schemas/`.
 *  - v1 (CH.4): library cache — `manga`, `volume`.
 *  - v2 (CH.7 4.2): adds local reading position — `progress` (additive, see [MIGRATION_1_2]).
 */
@Database(
    entities = [MangaEntity::class, VolumeEntity::class, ProgressEntity::class],
    version = 2,
    exportSchema = true,
)
abstract class MangaShelfDatabase : RoomDatabase() {
    abstract fun mangaDao(): MangaDao
    abstract fun volumeDao(): VolumeDao
    abstract fun progressDao(): ProgressDao
}
