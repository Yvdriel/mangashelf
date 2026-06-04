package com.mangashelf.reader.sync

import android.content.Context
import androidx.room.Room
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.work.ListenableWorker
import androidx.work.WorkerFactory
import androidx.work.WorkerParameters
import androidx.work.testing.TestListenableWorkerBuilder
import com.mangashelf.reader.data.local.MangaShelfDatabase
import com.mangashelf.reader.data.remote.MangaShelfApi
import com.mangashelf.reader.data.remote.dto.LibraryResponseDto
import com.mangashelf.reader.data.remote.dto.MangaDto
import com.mangashelf.reader.data.remote.dto.VolumeDto
import com.mangashelf.reader.data.remote.dto.WhoamiDto
import com.mangashelf.reader.data.repo.LibraryRepository
import com.mangashelf.reader.data.store.SyncStateStore
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.test.runTest
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import retrofit2.HttpException
import retrofit2.Response
import java.io.IOException

/**
 * 3.2 acceptance (instrumented): the first run pulls the full library (changedSince == null) and
 * writes rows; the second run pulls the delta (changedSince == lastSyncedAt), gets an empty payload,
 * and is a no-op. The cursor advances to the response's serverTime each run.
 */
@RunWith(AndroidJUnit4::class)
class LibraryDeltaWorkerTest {

    private lateinit var ctx: Context
    private lateinit var db: MangaShelfDatabase
    private lateinit var repo: LibraryRepository
    private lateinit var syncState: SyncStateStore
    private lateinit var api: FakeApi

    /** Returns a full library only on the initial (null) pull; an empty delta thereafter. */
    private class FakeApi : MangaShelfApi {
        var lastChangedSince: Long? = SENTINEL
        var error: Throwable? = null
        override suspend fun whoami(): WhoamiDto = throw UnsupportedOperationException()
        override suspend fun library(changedSince: Long?): LibraryResponseDto {
            lastChangedSince = changedSince
            error?.let { throw it }
            return if (changedSince == null) FULL else EMPTY
        }
        override suspend fun archive(mangaId: Int, volumeNumber: Int) = throw UnsupportedOperationException()
        override suspend fun ocr(mangaId: Int, volumeNumber: Int) = throw UnsupportedOperationException()
        override suspend fun pushProgress(request: com.mangashelf.reader.data.remote.dto.ProgressBatchRequestDto) = throw UnsupportedOperationException()
        override suspend fun getProgress(changedSince: Long?) =
            com.mangashelf.reader.data.remote.dto.ProgressPullResponseDto(serverTime = 0)
        companion object {
            const val SENTINEL = -1L
            val FULL = LibraryResponseDto(
                serverTime = 200,
                manga = listOf(
                    MangaDto(
                        id = 1, anilistId = 30002, title = "Berserk",
                        folderName = "Berserk [anilist-30002]", coverImage = null,
                        totalVolumes = 1, updatedAt = 150,
                        volumes = listOf(VolumeDto(1, 1, "v01", 150)),
                    ),
                ),
            )
            val EMPTY = LibraryResponseDto(serverTime = 300, manga = emptyList())
        }
    }

    @Before
    fun setup() {
        ctx = InstrumentationRegistry.getInstrumentation().targetContext
        db = Room.inMemoryDatabaseBuilder(ctx, MangaShelfDatabase::class.java).build()
        repo = LibraryRepository(db, db.mangaDao(), db.volumeDao())
        syncState = SyncStateStore(ctx)
        api = FakeApi()
        runBlocking { syncState.clear() } // isolate from prior runs
    }

    @After
    fun teardown() {
        db.close()
        runBlocking { syncState.clear() }
    }

    private fun buildWorker(): LibraryDeltaWorker =
        TestListenableWorkerBuilder<LibraryDeltaWorker>(ctx)
            .setWorkerFactory(object : WorkerFactory() {
                override fun createWorker(
                    appContext: Context,
                    workerClassName: String,
                    workerParameters: WorkerParameters,
                ): ListenableWorker = LibraryDeltaWorker(
                    appContext, workerParameters, api, repo, db.progressDao(), db.volumeDao(), syncState,
                )
            })
            .build()

    @Test
    fun firstRunWritesRows_secondRunIsNoop() = runTest {
        // Run 1 — full pull.
        assertEquals(ListenableWorker.Result.success(), buildWorker().doWork())
        assertNull("first pull uses no cursor", api.lastChangedSince)
        assertEquals(1, repo.observeLibrary().first().size)
        assertEquals(200L, syncState.lastSyncedAt())

        // Run 2 — delta pull, empty, no-op.
        assertEquals(ListenableWorker.Result.success(), buildWorker().doWork())
        assertEquals("second pull uses the stored cursor", 200L, api.lastChangedSince)
        assertEquals("library unchanged", 1, repo.observeLibrary().first().size)
        assertEquals(300L, syncState.lastSyncedAt())
    }

    @Test
    fun httpClientError_failsFast_doesNotRetry() = runTest {
        api.error = HttpException(
            Response.error<Any>(401, "".toResponseBody("application/json".toMediaType())),
        )
        assertEquals(ListenableWorker.Result.failure(), buildWorker().doWork())
    }

    @Test
    fun ioError_retries() = runTest {
        api.error = IOException("offline")
        assertEquals(ListenableWorker.Result.retry(), buildWorker().doWork())
    }
}
