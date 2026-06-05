package com.mangashelf.reader.data.local

import androidx.room.Room
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.mangashelf.reader.data.remote.dto.LibraryResponseDto
import com.mangashelf.reader.data.remote.dto.MangaDto
import com.mangashelf.reader.data.remote.dto.VolumeDto
import com.mangashelf.reader.data.repo.LibraryRepository
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

/**
 * 3.1 acceptance (instrumented): a delta inserted via the repo is observable through the DAO flow,
 * the DB opens at v1 (migration/open smoke), and a pin survives a later re-sync (server fields are
 * refreshed but client-owned `pinned` is preserved).
 */
@RunWith(AndroidJUnit4::class)
class LibraryDaoTest {

    private lateinit var db: MangaShelfDatabase
    private lateinit var repo: LibraryRepository

    @Before
    fun setup() {
        val ctx = InstrumentationRegistry.getInstrumentation().targetContext
        db = Room.inMemoryDatabaseBuilder(ctx, MangaShelfDatabase::class.java).build()
        repo = LibraryRepository(db, db.mangaDao(), db.volumeDao())
    }

    @After
    fun teardown() = db.close()

    private fun library(updatedAt: Long = 100, v1Pages: Int = 150) = LibraryResponseDto(
        serverTime = 200,
        manga = listOf(
            MangaDto(
                id = 1,
                anilistId = 30002,
                title = "Berserk",
                folderName = "Berserk [anilist-30002]",
                coverImage = null,
                totalVolumes = 2,
                updatedAt = updatedAt,
                volumes = listOf(
                    VolumeDto(id = 1, volumeNumber = 1, folderName = "v01", pageCount = v1Pages),
                    VolumeDto(id = 2, volumeNumber = 2, folderName = "v02", pageCount = 165),
                ),
            ),
        ),
    )

    @Test
    fun applyDelta_thenObserveLibrary_emitsMangaWithVolumes() = runTest {
        repo.applyDelta(library())

        val all = repo.observeLibrary().first()
        assertEquals(1, all.size)
        assertEquals("Berserk", all[0].manga.title)
        assertEquals(2, all[0].volumes.size)
    }

    @Test
    fun database_opensAtCurrentVersion() {
        // v2 = CH.7 `progress` (MIGRATION_1_2); v3 = CH.8 `download_queue` (MIGRATION_2_3).
        // (Stale `2` here was a pre-existing CH.8 oversight — the schema has been v3 since CH.8.)
        assertEquals(3, db.openHelper.readableDatabase.version)
    }

    @Test
    fun setPinned_persists_andSurvivesResync() = runTest {
        repo.applyDelta(library())
        repo.setPinned(mangaId = 1, volumeNumber = 1, pinned = true)

        val pinned = repo.observeManga(1).first()!!.volumes.single { it.volumeNumber == 1 }
        assertTrue(pinned.pinned)

        // A later sync refreshes server fields; the pin must remain.
        repo.applyDelta(library(updatedAt = 300, v1Pages = 999))

        val after = repo.observeManga(1).first()!!.volumes.single { it.volumeNumber == 1 }
        assertTrue("pin must survive a re-sync", after.pinned)
        assertEquals("server field refreshed", 999, after.pageCount)
    }
}
