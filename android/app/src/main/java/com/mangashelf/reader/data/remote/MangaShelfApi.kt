package com.mangashelf.reader.data.remote

import com.mangashelf.reader.data.remote.dto.LibraryResponseDto
import com.mangashelf.reader.data.remote.dto.ProgressBatchRequestDto
import com.mangashelf.reader.data.remote.dto.ProgressBatchResultDto
import com.mangashelf.reader.data.remote.dto.ProgressPullResponseDto
import com.mangashelf.reader.data.remote.dto.WhoamiDto
import okhttp3.ResponseBody
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query
import retrofit2.http.Streaming

/**
 * The native-client surface of the server (`/api/v1`). Paths are relative — [AuthInterceptor]
 * supplies the host from the [com.mangashelf.reader.data.store.TokenStore]. Covers are fetched via
 * Coil (same authed client). The CBZ + OCR sidecar use `@Streaming` so the worker copies bytes
 * straight to disk without buffering the whole archive in memory.
 */
interface MangaShelfApi {

    @GET("api/v1/auth/whoami")
    suspend fun whoami(): WhoamiDto

    @GET("api/v1/library")
    suspend fun library(@Query("changedSince") changedSince: Long? = null): LibraryResponseDto

    /** CBZ stream (CH.3 1.3). Caller writes the [ResponseBody] bytes to the archive path (CH.8/5.1). */
    @Streaming
    @GET("api/v1/manga/{id}/volume/{volumeNumber}/archive")
    suspend fun archive(
        @Path("id") mangaId: Int,
        @Path("volumeNumber") volumeNumber: Int,
    ): Response<ResponseBody>

    /** `.mokuro` OCR sidecar (O-S.1). 404 when the volume was never OCR'd — caller skips it (O.1). */
    @Streaming
    @GET("api/v1/manga/{id}/volume/{volumeNumber}/ocr")
    suspend fun ocr(
        @Path("id") mangaId: Int,
        @Path("volumeNumber") volumeNumber: Int,
    ): Response<ResponseBody>

    /** Push local reading progress, last-write-wins by `clientUpdatedAt` (CH.3 1.4 / CH.8 5.3). */
    @POST("api/v1/progress/batch")
    suspend fun pushProgress(@Body request: ProgressBatchRequestDto): ProgressBatchResultDto

    /** Pull progress changed since a cursor (unix seconds) for the LWW merge (CH.8/5.4). */
    @GET("api/v1/progress")
    suspend fun getProgress(@Query("changedSince") changedSince: Long? = null): ProgressPullResponseDto
}
