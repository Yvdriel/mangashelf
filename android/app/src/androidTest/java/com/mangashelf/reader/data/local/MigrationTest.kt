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
 * 4.2: the v1→v2 migration must ADD the `progress` table without disturbing CH.4's library tables
 * (the user's pinned volumes must survive). Destructive recreation is forbidden.
 */
@RunWith(AndroidJUnit4::class)
class MigrationTest {

    private val dbName = "migration-test.db"

    @get:Rule
    val helper = MigrationTestHelper(
        InstrumentationRegistry.getInstrumentation(),
        MangaShelfDatabase::class.java,
    )

    @Test
    fun migrate1To2_preservesLibraryAndPins_andAddsWritableProgress() {
        helper.createDatabase(dbName, 1).apply {
            execSQL(
                "INSERT INTO manga (id, anilistId, title, folderName, coverImage, totalVolumes, updatedAt) " +
                    "VALUES (1, NULL, 'Berserk', 'Berserk', NULL, 2, 100)",
            )
            execSQL(
                "INSERT INTO volume (mangaId, volumeNumber, serverVolumeId, folderName, pageCount, pinned) " +
                    "VALUES (1, 1, 10, 'v01', 150, 1)",
            )
            close()
        }

        val db = helper.runMigrationsAndValidate(dbName, 2, true, MIGRATION_1_2)

        db.query("SELECT title FROM manga WHERE id = 1").use { c ->
            assertTrue(c.moveToFirst())
            assertEquals("Berserk", c.getString(0))
        }
        db.query("SELECT pinned FROM volume WHERE mangaId = 1 AND volumeNumber = 1").use { c ->
            assertTrue(c.moveToFirst())
            assertEquals("pin must survive migration", 1, c.getInt(0))
        }
        // progress table exists and is writable
        db.execSQL(
            "INSERT INTO progress (mangaId, volumeNumber, currentPage, clientUpdatedAt, syncedUpdatedAt) " +
                "VALUES (1, 1, 5, 200, NULL)",
        )
        db.query("SELECT currentPage FROM progress WHERE mangaId = 1 AND volumeNumber = 1").use { c ->
            assertTrue(c.moveToFirst())
            assertEquals(5, c.getInt(0))
        }
        db.close()
    }
}
