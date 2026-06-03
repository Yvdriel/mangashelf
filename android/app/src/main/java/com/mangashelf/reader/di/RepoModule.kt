package com.mangashelf.reader.di

import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent

/**
 * Repository bindings (Library/Progress/Download). Populated alongside Phase 3–5 repos.
 */
@Module
@InstallIn(SingletonComponent::class)
object RepoModule
