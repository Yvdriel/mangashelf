package com.mangashelf.reader.data.remote

import com.mangashelf.reader.data.remote.dto.LibraryResponseDto
import com.mangashelf.reader.data.remote.dto.WhoamiDto
import retrofit2.http.GET
import retrofit2.http.Query

/**
 * The native-client surface of the server (`/api/v1`). Paths are relative — [AuthInterceptor]
 * supplies the host from the [com.mangashelf.reader.data.store.TokenStore]. Covers and volume
 * archives are fetched outside Retrofit (Coil / streaming), so they are not declared here.
 */
interface MangaShelfApi {

    @GET("api/v1/auth/whoami")
    suspend fun whoami(): WhoamiDto

    @GET("api/v1/library")
    suspend fun library(@Query("changedSince") changedSince: Long? = null): LibraryResponseDto
}
