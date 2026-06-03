package com.mangashelf.reader.di

import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent

/**
 * Room AppDatabase + DAO providers. Populated in 3.1 (Room v1 + entities).
 */
@Module
@InstallIn(SingletonComponent::class)
object DatabaseModule
