package com.mangashelf.reader.di

import android.content.Context
import com.mangashelf.reader.flashcards.data.AnkiBackend
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import java.io.File
import javax.inject.Qualifier
import javax.inject.Singleton

/** The on-disk directory holding the flashcards collection (`collection.anki2` + media). */
@Qualifier
@Retention(AnnotationRetention.BINARY)
annotation class CollectionDir

/** Flashcards backend wiring (F.2). [CollectionRepository] is `@Inject`-constructed. */
@Module
@InstallIn(SingletonComponent::class)
object BackendModule {

    @Provides
    @Singleton
    fun provideAnkiBackend(): AnkiBackend = AnkiBackend()

    @Provides
    @Singleton
    @CollectionDir
    fun provideCollectionDir(@ApplicationContext context: Context): File =
        File(context.filesDir, "anki")
}
