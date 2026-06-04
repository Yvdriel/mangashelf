package com.mangashelf.dict.data.di

import android.content.Context
import com.mangashelf.dict.data.DictDbFile
import com.mangashelf.dict.data.DictEngine
import com.mangashelf.dict.data.DictEngineImpl
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import java.io.File
import javax.inject.Singleton

/**
 * Dictionary data-layer DI (CH.6). Provides the [DictEngine] (lazily opens the prebaked dict.db on
 * first query) and the working-copy [DictDbFile] location. Separate from the reader's
 * `DatabaseModule` (CH.4) — no collision.
 */
@Module
@InstallIn(SingletonComponent::class)
object DictDataModule {

    @Provides
    @Singleton
    @DictDbFile
    fun provideDictDbFile(@ApplicationContext context: Context): File =
        File(context.filesDir, "dict/dict.db")

    @Provides
    @Singleton
    fun provideDictEngine(impl: DictEngineImpl): DictEngine = impl
}
