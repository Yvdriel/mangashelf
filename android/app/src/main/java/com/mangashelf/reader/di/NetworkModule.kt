package com.mangashelf.reader.di

import android.content.Context
import coil.ImageLoader
import com.mangashelf.reader.data.remote.AuthEventBus
import com.mangashelf.reader.data.remote.AuthInterceptor
import com.mangashelf.reader.data.remote.MangaShelfApi
import com.mangashelf.reader.data.store.EncryptedTokenStore
import com.mangashelf.reader.data.store.TokenStore
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory
import javax.inject.Singleton

/**
 * Retrofit / OkHttp / TokenStore / Coil wiring (CH.4 2.2). One authed [OkHttpClient] is shared by
 * Retrofit and the Coil [ImageLoader]; [AuthInterceptor] rewrites the placeholder base URL to the
 * stored server origin and adds the bearer token on every call.
 */
@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {

    /** Stand-in host; [AuthInterceptor] swaps scheme/host/port for the stored server URL at call time. */
    private const val PLACEHOLDER_BASE_URL = "http://localhost/"

    @Provides
    @Singleton
    fun provideTokenStore(@ApplicationContext context: Context): TokenStore =
        EncryptedTokenStore(context)

    @Provides
    @Singleton
    fun provideJson(): Json = Json {
        ignoreUnknownKeys = true
        explicitNulls = false
    }

    @Provides
    @Singleton
    fun provideOkHttpClient(tokenStore: TokenStore, authEventBus: AuthEventBus): OkHttpClient =
        OkHttpClient.Builder()
            .addInterceptor(AuthInterceptor(tokenStore, authEventBus))
            .addInterceptor(
                HttpLoggingInterceptor().apply { level = HttpLoggingInterceptor.Level.BASIC },
            )
            .build()

    @Provides
    @Singleton
    fun provideRetrofit(client: OkHttpClient, json: Json): Retrofit =
        Retrofit.Builder()
            .baseUrl(PLACEHOLDER_BASE_URL)
            .client(client)
            .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
            .build()

    @Provides
    @Singleton
    fun provideMangaShelfApi(retrofit: Retrofit): MangaShelfApi =
        retrofit.create(MangaShelfApi::class.java)

    @Provides
    @Singleton
    fun provideImageLoader(
        @ApplicationContext context: Context,
        client: OkHttpClient,
    ): ImageLoader = ImageLoader.Builder(context).okHttpClient(client).build()
}
