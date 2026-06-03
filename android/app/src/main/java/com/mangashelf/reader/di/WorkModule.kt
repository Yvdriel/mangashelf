package com.mangashelf.reader.di

import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent

/**
 * WorkManager / HiltWorkerFactory wiring. Populated in 3.2 (LibraryDeltaWorker) onward.
 */
@Module
@InstallIn(SingletonComponent::class)
object WorkModule
