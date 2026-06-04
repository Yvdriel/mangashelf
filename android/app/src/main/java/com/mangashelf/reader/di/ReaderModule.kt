package com.mangashelf.reader.di

import android.content.Context
import com.mangashelf.reader.data.reader.PageSource
import com.mangashelf.reader.data.reader.PageSourceFactory
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import java.io.File
import javax.inject.Singleton

/** Reader pillar (CH.7). Resolves the local CBZ + tunes decode sampling to the device display. */
@Module
@InstallIn(SingletonComponent::class)
object ReaderModule {

    @Provides
    @Singleton
    fun providePageSourceFactory(@ApplicationContext context: Context): PageSourceFactory =
        PageSourceFactory { mangaId, volumeNumber ->
            // CH.8/5.1 streams downloads here; CH.7 acceptance pushes fixtures via `adb push`.
            val cbz = File(context.filesDir, "archives/$mangaId/v$volumeNumber.cbz")
            val metrics = context.resources.displayMetrics
            // ~480px usable on the 800×480 Kompakt; the shorter edge bounds a fit-to-height page.
            val targetWidth = minOf(metrics.widthPixels, metrics.heightPixels).coerceAtLeast(1)
            PageSource(cbz, targetWidth)
        }
}
