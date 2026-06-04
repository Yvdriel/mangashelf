package com.mangashelf.reader.di

import android.content.Context
import androidx.work.WorkManager
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

/**
 * WorkManager wiring (CH.4 3.2). The HiltWorkerFactory itself comes from `androidx.hilt:hilt-work`
 * and is installed via [com.mangashelf.reader.MangaShelfApp]'s Configuration.Provider.
 */
@Module
@InstallIn(SingletonComponent::class)
object WorkModule {

    @Provides
    @Singleton
    fun provideWorkManager(@ApplicationContext context: Context): WorkManager =
        WorkManager.getInstance(context)
}
