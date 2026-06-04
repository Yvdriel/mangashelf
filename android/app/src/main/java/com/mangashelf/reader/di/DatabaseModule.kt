package com.mangashelf.reader.di

import android.content.Context
import androidx.room.Room
import com.mangashelf.reader.data.local.DownloadDao
import com.mangashelf.reader.data.local.MIGRATION_1_2
import com.mangashelf.reader.data.local.MIGRATION_2_3
import com.mangashelf.reader.data.local.MangaDao
import com.mangashelf.reader.data.local.MangaShelfDatabase
import com.mangashelf.reader.data.local.ProgressDao
import com.mangashelf.reader.data.local.VolumeDao
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

/** Room AppDatabase + DAO providers (CH.4 3.1; CH.7 4.2 adds progress + the v1→v2 migration). */
@Module
@InstallIn(SingletonComponent::class)
object DatabaseModule {

    @Provides
    @Singleton
    fun provideDatabase(@ApplicationContext context: Context): MangaShelfDatabase =
        Room.databaseBuilder(context, MangaShelfDatabase::class.java, "mangashelf.db")
            .addMigrations(MIGRATION_1_2, MIGRATION_2_3)
            .build()

    @Provides
    fun provideMangaDao(db: MangaShelfDatabase): MangaDao = db.mangaDao()

    @Provides
    fun provideVolumeDao(db: MangaShelfDatabase): VolumeDao = db.volumeDao()

    @Provides
    fun provideProgressDao(db: MangaShelfDatabase): ProgressDao = db.progressDao()

    @Provides
    fun provideDownloadDao(db: MangaShelfDatabase): DownloadDao = db.downloadDao()
}
