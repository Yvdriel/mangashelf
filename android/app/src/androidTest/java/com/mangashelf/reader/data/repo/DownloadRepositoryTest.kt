package com.mangashelf.reader.data.repo

import android.content.Context
import androidx.room.Room
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.work.Configuration
import androidx.work.WorkManager
import androidx.work.testing.SynchronousExecutor
import androidx.work.testing.WorkManagerTestInitHelper
import com.mangashelf.reader.data.local.MangaShelfDatabase
import com.mangashelf.reader.data.local.entities.DownloadEntity
import com.mangashelf.reader.data.local.entities.DownloadState
import com.mangashelf.reader.data.reader.ArchivePaths
import com.mangashelf.reader.sync.DownloadVolumeWorker
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

/** CH.8/5.1 + O.1: pin enqueues unique work; unpin cancels and deletes BOTH the CBZ and the sidecar. */
@RunWith(AndroidJUnit4::class)
class DownloadRepositoryTest {

    private lateinit var ctx: Context
    private lateinit var db: MangaShelfDatabase
    private lateinit var repo: DownloadRepository

    private val mangaId = 5
    private val volumeNumber = 1

    @Before
    fun setup() {
        ctx = InstrumentationRegistry.getInstrumentation().targetContext
        WorkManagerTestInitHelper.initializeTestWorkManager(
            ctx,
            Configuration.Builder().setExecutor(SynchronousExecutor()).build(),
        )
        db = Room.inMemoryDatabaseBuilder(ctx, MangaShelfDatabase::class.java).build()
        repo = DownloadRepository(ctx, WorkManager.getInstance(ctx), db.downloadDao())
        ArchivePaths.dir(ctx.filesDir, mangaId).deleteRecursively()
    }

    @After
    fun teardown() {
        db.close()
        ArchivePaths.dir(ctx.filesDir, mangaId).deleteRecursively()
    }

    @Test
    fun enqueue_seedsQueuedRow_andUniqueWork() = runBlocking {
        repo.enqueue(mangaId, volumeNumber)

        assertEquals(DownloadState.QUEUED, db.downloadDao().get(mangaId, volumeNumber)?.state)
        val infos = WorkManager.getInstance(ctx)
            .getWorkInfosForUniqueWork(DownloadVolumeWorker.uniqueName(mangaId, volumeNumber))
            .get()
        assertEquals(1, infos.size)
    }

    @Test
    fun cancel_deletesCbzAndMokuroAndRow() = runBlocking {
        val cbz = ArchivePaths.cbz(ctx.filesDir, mangaId, volumeNumber).apply { parentFile?.mkdirs(); writeText("cbz") }
        val mokuro = ArchivePaths.mokuro(ctx.filesDir, mangaId, volumeNumber).apply { writeText("ocr") }
        db.downloadDao().upsert(DownloadEntity(mangaId, volumeNumber, DownloadState.DOWNLOADED, updatedAt = 1))

        repo.cancel(mangaId, volumeNumber)

        assertFalse("CBZ deleted on unpin", cbz.exists())
        assertFalse("mokuro sidecar deleted on unpin", mokuro.exists())
        assertNull("queue row removed on unpin", db.downloadDao().get(mangaId, volumeNumber))
    }

    @Test
    fun observeDownloads_reflectsDao() = runBlocking {
        db.downloadDao().upsert(DownloadEntity(mangaId, volumeNumber, DownloadState.FAILED, updatedAt = 1))
        val rows = repo.observeDownloads().first()
        assertEquals(1, rows.size)
        assertEquals(DownloadState.FAILED, rows[0].state)
    }
}
