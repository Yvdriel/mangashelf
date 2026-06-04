package com.mangashelf.reader.data.local

import androidx.room.Database
import androidx.room.RoomDatabase
import com.mangashelf.reader.data.local.entities.MangaEntity
import com.mangashelf.reader.data.local.entities.VolumeEntity

/** Reader-pillar library cache (CH.4 v1). Schema JSON is exported to `app/schemas/`. */
@Database(
    entities = [MangaEntity::class, VolumeEntity::class],
    version = 1,
    exportSchema = true,
)
abstract class MangaShelfDatabase : RoomDatabase() {
    abstract fun mangaDao(): MangaDao
    abstract fun volumeDao(): VolumeDao
}
