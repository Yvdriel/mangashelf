package com.mangashelf.reader.data.local

import androidx.room.testing.MigrationTestHelper
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * CH.8/5.1: v2→v3 ADDS the `download_queue` table without disturbing CH.4/CH.7 data — the user's
 * pinned volumes and reading progress must survive. Destructive recreation is forbidden.
 */
@RunWith(AndroidJUnit4::class)
class MigrationV3Test {

    private val dbName = "migration-v3-test.db"

    @get:Rule
    val helper = MigrationTestHelper(
        InstrumentationRegistry.getInstrumentation(),
        MangaShelfDatabase::class.java,
    )

    @Test
    fun migrate2To3_preservesPinsAndProgress_andAddsWritableDownloadQueue() {
        helper.createDatabase(dbName, 2).apply {
            execSQL(
                "INSERT INTO manga (id, anilistId, title, folderName, coverImage, totalVolumes, updatedAt) " +
                    "VALUES (1, NULL, 'Berserk', 'Berserk', NULL, 2, 100)",
            )
            execSQL(
                "INSERT INTO volume (mangaId, volumeNumber, serverVolumeId, folderName, pageCount, pinned) " +
                    "VALUES (1, 1, 10, 'v01', 150, 1)",
            )
            execSQL(
                "INSERT INTO progress (mangaId, volumeNumber, currentPage, clientUpdatedAt, syncedUpdatedAt) " +
                    "VALUES (1, 1, 7, 12345, NULL)",
            )
            close()
        }

        val db = helper.runMigrationsAndValidate(dbName, 3, true, MIGRATION_2_3)

        db.query("SELECT pinned FROM volume WHERE mangaId = 1 AND volumeNumber = 1").use { c ->
            assertTrue(c.moveToFirst())
            assertEquals("pin must survive v2→v3", 1, c.getInt(0))
        }
        db.query("SELECT currentPage FROM progress WHERE mangaId = 1 AND volumeNumber = 1").use { c ->
            assertTrue(c.moveToFirst())
            assertEquals("progress must survive v2→v3", 7, c.getInt(0))
        }
        // download_queue exists and is writable
        db.execSQL(
            "INSERT INTO download_queue (mangaId, volumeNumber, state, bytesDownloaded, totalBytes, errorMessage, updatedAt) " +
                "VALUES (1, 1, 'QUEUED', 0, 0, NULL, 200)",
        )
        db.query("SELECT state FROM download_queue WHERE mangaId = 1 AND volumeNumber = 1").use { c ->
            assertTrue(c.moveToFirst())
            assertEquals("QUEUED", c.getString(0))
        }
        db.close()
    }
}
