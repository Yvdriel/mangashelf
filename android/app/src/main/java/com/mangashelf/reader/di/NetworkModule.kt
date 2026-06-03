package com.mangashelf.reader.di

import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent

/**
 * Retrofit / OkHttp / AuthInterceptor providers. Populated in 2.2 (TokenStore + Retrofit).
 */
@Module
@InstallIn(SingletonComponent::class)
object NetworkModule
