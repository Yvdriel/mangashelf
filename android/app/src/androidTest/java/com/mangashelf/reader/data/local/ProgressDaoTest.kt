package com.mangashelf.reader.data.local

import androidx.room.Room
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.mangashelf.reader.data.repo.ProgressRepository
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

/** 4.2: local progress persistence + resume, exercised through [ProgressRepository]. */
@RunWith(AndroidJUnit4::class)
class ProgressDaoTest {

    private lateinit var db: MangaShelfDatabase
    private lateinit var repo: ProgressRepository

    @Before
    fun setup() {
        val ctx = InstrumentationRegistry.getInstrumentation().targetContext
        db = Room.inMemoryDatabaseBuilder(ctx, MangaShelfDatabase::class.java).build()
        repo = ProgressRepository(db.progressDao())
    }

    @After
    fun teardown() = db.close()

    @Test
    fun resumePage_defaultsToZero_whenUnread() = runTest {
        assertEquals(0, repo.resumePage(mangaId = 1, volumeNumber = 1))
    }

    @Test
    fun write_thenResume_returnsLastPage() = runTest {
        repo.write(mangaId = 1, volumeNumber = 1, page = 7, now = 1_000)
        assertEquals(7, repo.resumePage(1, 1))
    }

    @Test
    fun write_isUpsert_andObserveEmitsLatest() = runTest {
        repo.write(1, 1, page = 3, now = 1_000)
        repo.write(1, 1, page = 9, now = 2_000)
        val latest = repo.observe(1, 1).first()
        assertEquals(9, latest?.currentPage)
        assertEquals("local writes leave syncedUpdatedAt null for CH.8", null, latest?.syncedUpdatedAt)
    }
}
