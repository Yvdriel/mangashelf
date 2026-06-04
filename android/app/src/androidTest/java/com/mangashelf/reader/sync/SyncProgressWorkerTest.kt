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
import com.mangashelf.reader.data.remote.dto.ProgressBatchRequestDto
import com.mangashelf.reader.data.remote.dto.ProgressBatchResultDto
import com.mangashelf.reader.data.remote.dto.ProgressRefDto
import com.mangashelf.reader.data.remote.dto.ProgressRejectionDto
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

/**
 * CH.8/5.3 acceptance (kompakt28): dirty progress goes out as ONE batch (mapped to server volumeId,
 * seconds); accepted + rejected both clear the dirty flag without retry.
 */
@RunWith(AndroidJUnit4::class)
class SyncProgressWorkerTest {

    private lateinit var ctx: Context
    private lateinit var db: MangaShelfDatabase
    private lateinit var api: FakeApi

    @Before
    fun setup() {
        ctx = InstrumentationRegistry.getInstrumentation().targetContext
        db = Room.inMemoryDatabaseBuilder(ctx, MangaShelfDatabase::class.java).build()
        api = FakeApi()
        runBlocking {
            // Volumes provide the serverVolumeId the push addresses.
            db.volumeDao().insertIgnore(
                listOf(
                    VolumeEntity(mangaId = 1, volumeNumber = 2, serverVolumeId = 77, folderName = "v02", pageCount = 20),
                    VolumeEntity(mangaId = 1, volumeNumber = 3, serverVolumeId = 78, folderName = "v03", pageCount = 20),
                ),
            )
        }
    }

    @After
    fun teardown() = db.close()

    @Test
    fun dirtyProgress_pushedAsOneBatch_andMarkedSynced() = runTest {
        // Simulates "read 10 pages offline": one volume, latest page = 9, never synced.
        db.progressDao().upsert(ProgressEntity(1, 2, currentPage = 9, clientUpdatedAt = 1_000, syncedUpdatedAt = null))
        api.result = ProgressBatchResultDto(accepted = listOf(ProgressRefDto(1, 77)))

        assertEquals(ListenableWorker.Result.success(), buildWorker().doWork())

        assertEquals("exactly one batch POST", 1, api.pushCount)
        val entries = api.lastRequest!!.entries
        assertEquals(1, entries.size)
        assertEquals(77, entries[0].volumeId)
        assertEquals(9, entries[0].currentPage)
        assertEquals(1L, entries[0].clientUpdatedAt) // 1000 ms → 1 s
        // Dirty flag cleared.
        assertEquals(1_000L, db.progressDao().get(1, 2)?.syncedUpdatedAt)
        assertEquals(0, db.progressDao().selectDirty().size)
    }

    @Test
    fun multipleDirtyVolumes_goOutInOneBatch() = runTest {
        db.progressDao().upsert(ProgressEntity(1, 2, currentPage = 5, clientUpdatedAt = 1_000, syncedUpdatedAt = null))
        db.progressDao().upsert(ProgressEntity(1, 3, currentPage = 1, clientUpdatedAt = 2_000, syncedUpdatedAt = null))
        api.result = ProgressBatchResultDto(accepted = listOf(ProgressRefDto(1, 77), ProgressRefDto(1, 78)))

        assertEquals(ListenableWorker.Result.success(), buildWorker().doWork())

        assertEquals(1, api.pushCount)
        assertEquals(2, api.lastRequest!!.entries.size)
        assertEquals(0, db.progressDao().selectDirty().size)
    }

    @Test
    fun rejectedEntry_clearsDirty_withoutRetry() = runTest {
        db.progressDao().upsert(ProgressEntity(1, 2, currentPage = 9, clientUpdatedAt = 1_000, syncedUpdatedAt = null))
        api.result = ProgressBatchResultDto(rejected = listOf(ProgressRejectionDto(1, 77, "stale")))

        assertEquals(ListenableWorker.Result.success(), buildWorker().doWork())

        assertEquals("rejected does not retry the request", 1, api.pushCount)
        assertEquals("rejected still clears the dirty flag", 1_000L, db.progressDao().get(1, 2)?.syncedUpdatedAt)
    }

    @Test
    fun noDirtyProgress_isNoop_noRequest() = runTest {
        assertEquals(ListenableWorker.Result.success(), buildWorker().doWork())
        assertEquals(0, api.pushCount)
    }

    private fun buildWorker(): SyncProgressWorker =
        TestListenableWorkerBuilder<SyncProgressWorker>(ctx)
            .setWorkerFactory(object : WorkerFactory() {
                override fun createWorker(
                    appContext: Context,
                    workerClassName: String,
                    workerParameters: WorkerParameters,
                ): ListenableWorker = SyncProgressWorker(appContext, workerParameters, api, db.progressDao())
            })
            .build()

    private class FakeApi : MangaShelfApi {
        var pushCount = 0
        var lastRequest: ProgressBatchRequestDto? = null
        var result = ProgressBatchResultDto()
        override suspend fun whoami() = throw UnsupportedOperationException()
        override suspend fun library(changedSince: Long?) = throw UnsupportedOperationException()
        override suspend fun archive(mangaId: Int, volumeNumber: Int) = throw UnsupportedOperationException()
        override suspend fun ocr(mangaId: Int, volumeNumber: Int) = throw UnsupportedOperationException()
        override suspend fun pushProgress(request: ProgressBatchRequestDto): ProgressBatchResultDto {
            pushCount++
            lastRequest = request
            return result
        }
        override suspend fun getProgress(changedSince: Long?) = throw UnsupportedOperationException()
    }
}
