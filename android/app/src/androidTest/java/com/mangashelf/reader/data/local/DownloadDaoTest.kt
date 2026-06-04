package com.mangashelf.reader.data.local

import androidx.room.Room
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.mangashelf.reader.data.local.entities.DownloadEntity
import com.mangashelf.reader.data.local.entities.DownloadState
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

/** CH.8/5.1: the download_queue DAO backs DownloadsScreen + the worker's durable state. */
@RunWith(AndroidJUnit4::class)
class DownloadDaoTest {

    private lateinit var db: MangaShelfDatabase
    private lateinit var dao: DownloadDao

    @Before
    fun setup() {
        val ctx = InstrumentationRegistry.getInstrumentation().targetContext
        db = Room.inMemoryDatabaseBuilder(ctx, MangaShelfDatabase::class.java).build()
        dao = db.downloadDao()
    }

    @After
    fun teardown() = db.close()

    @Test
    fun upsert_thenObserve_returnsRow() = runTest {
        dao.upsert(DownloadEntity(1, 2, DownloadState.DOWNLOADING, bytesDownloaded = 50, totalBytes = 100, updatedAt = 1))
        val rows = dao.observeAll().first()
        assertEquals(1, rows.size)
        assertEquals(DownloadState.DOWNLOADING, rows[0].state)
        assertEquals(50L, rows[0].bytesDownloaded)
    }

    @Test
    fun upsert_sameKey_replacesState() = runTest {
        dao.upsert(DownloadEntity(1, 2, DownloadState.DOWNLOADING, updatedAt = 1))
        dao.upsert(DownloadEntity(1, 2, DownloadState.DOWNLOADED, bytesDownloaded = 100, totalBytes = 100, updatedAt = 2))
        val rows = dao.observeAll().first()
        assertEquals("same (mangaId,volumeNumber) upserts in place", 1, rows.size)
        assertEquals(DownloadState.DOWNLOADED, rows[0].state)
    }

    @Test
    fun delete_removesRow() = runTest {
        dao.upsert(DownloadEntity(1, 2, DownloadState.FAILED, errorMessage = "boom", updatedAt = 1))
        dao.delete(1, 2)
        assertNull(dao.get(1, 2))
        assertEquals(0, dao.observeAll().first().size)
    }
}
