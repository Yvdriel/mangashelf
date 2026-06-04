package com.mangashelf.reader

import android.app.Application
import androidx.hilt.work.HiltWorkerFactory
import androidx.work.Configuration
import coil.ImageLoader
import coil.ImageLoaderFactory
import dagger.hilt.android.HiltAndroidApp
import javax.inject.Inject

/**
 * Wires two app-level singletons:
 * - WorkManager's on-demand [Configuration] with the [HiltWorkerFactory] so
 *   [com.mangashelf.reader.sync.LibraryDeltaWorker]'s `@AssistedInject` deps resolve (the default
 *   WorkManager initializer is removed in the manifest in favour of this — CH.4 3.2).
 * - Coil's singleton [ImageLoader] = the authed one from DI, so cover requests carry the bearer
 *   token without per-call wiring (CH.4 3.3).
 */
@HiltAndroidApp
class MangaShelfApp : Application(), Configuration.Provider, ImageLoaderFactory {

    @Inject
    lateinit var workerFactory: HiltWorkerFactory

    @Inject
    lateinit var imageLoader: ImageLoader

    override val workManagerConfiguration: Configuration
        get() = Configuration.Builder()
            .setWorkerFactory(workerFactory)
            .build()

    override fun newImageLoader(): ImageLoader = imageLoader
}
