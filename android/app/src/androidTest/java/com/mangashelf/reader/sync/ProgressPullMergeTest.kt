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
import com.mangashelf.reader.data.local.entities.ProgressEntity
import com.mangashelf.reader.data.local.entities.VolumeEntity
import com.mangashelf.reader.data.remote.MangaShelfApi
import com.mangashelf.reader.data.remote.dto.LibraryResponseDto
import com.mangashelf.reader.data.remote.dto.ProgressBatchRequestDto
import com.mangashelf.reader.data.remote.dto.ProgressPullResponseDto
import com.mangashelf.reader.data.remote.dto.ServerProgressDto
import com.mangashelf.reader.data.repo.LibraryRepository
import com.mangashelf.reader.data.store.SyncStateStore
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

/**
 * CH.8/5.4 gate anchor (kompakt28): the progress pull reconciles last-write-wins in BOTH directions —
 * a server-newer row updates the device, a device-local-newer row survives the pull.
 */
@RunWith(AndroidJUnit4::class)
class ProgressPullMergeTest {

    private lateinit var ctx: Context
    private lateinit var db: MangaShelfDatabase
    private lateinit var repo: LibraryRepository
    private lateinit var syncState: SyncStateStore
    private lateinit var api: FakeApi

    @Before
    fun setup() {
        ctx = InstrumentationRegistry.getInstrumentation().targetContext
        db = Room.inMemoryDatabaseBuilder(ctx, MangaShelfDatabase::class.java).build()
        repo = LibraryRepository(db, db.mangaDao(), db.volumeDao())
        syncState = SyncStateStore(ctx)
        api = FakeApi()
        runBlocking {
            syncState.clear()
            db.volumeDao().insertIgnore(
                listOf(VolumeEntity(mangaId = 1, volumeNumber = 2, serverVolumeId = 77, folderName = "v02", pageCount = 50)),
            )
        }
    }

    @After
    fun teardown() {
        db.close()
        runBlocking { syncState.clear() }
    }

    @Test
    fun serverNewer_updatesDeviceRow() = runTest {
        db.progressDao().upsert(ProgressEntity(1, 2, currentPage = 3, clientUpdatedAt = 1_000, syncedUpdatedAt = 1_000))
        api.progress = listOf(ServerProgressDto(mangaId = 1, volumeId = 77, currentPage = 40, updatedAt = 2)) // 2s = 2000ms > 1000

        assertEquals(ListenableWorker.Result.success(), buildWorker().doWork())

        assertEquals("server-newer overwrites local", 40, db.progressDao().get(1, 2)?.currentPage)
    }

    @Test
    fun deviceLocalNewer_survivesPull() = runTest {
        db.progressDao().upsert(ProgressEntity(1, 2, currentPage = 9, clientUpdatedAt = 5_000, syncedUpdatedAt = null))
        api.progress = listOf(ServerProgressDto(mangaId = 1, volumeId = 77, currentPage = 1, updatedAt = 2)) // 2s = 2000ms < 5000

        assertEquals(ListenableWorker.Result.success(), buildWorker().doWork())

        assertEquals("device-local newer is not clobbered", 9, db.progressDao().get(1, 2)?.currentPage)
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

    private class FakeApi : MangaShelfApi {
        var progress: List<ServerProgressDto> = emptyList()
        override suspend fun whoami() = throw UnsupportedOperationException()
        override suspend fun library(changedSince: Long?) = LibraryResponseDto(serverTime = 100, manga = emptyList())
        override suspend fun archive(mangaId: Int, volumeNumber: Int) = throw UnsupportedOperationException()
        override suspend fun ocr(mangaId: Int, volumeNumber: Int) = throw UnsupportedOperationException()
        override suspend fun pushProgress(request: ProgressBatchRequestDto) = throw UnsupportedOperationException()
        override suspend fun getProgress(changedSince: Long?) =
            ProgressPullResponseDto(serverTime = 200, progress = progress)
    }
}
