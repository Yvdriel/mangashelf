package com.mangashelf.reader.data.local

import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

/**
 * v1 (CH.4 library) → v2 (CH.7 reading progress). Purely additive: creates the `progress` table and
 * leaves `manga`/`volume` (and the user's pins) untouched. SQL is copied verbatim from Room's
 * exported `2.json` so [androidx.room.testing.MigrationTestHelper] validates the result exactly.
 */
val MIGRATION_1_2 = object : Migration(1, 2) {
    override fun migrate(db: SupportSQLiteDatabase) {
        db.execSQL(
            "CREATE TABLE IF NOT EXISTS `progress` (" +
                "`mangaId` INTEGER NOT NULL, " +
                "`volumeNumber` INTEGER NOT NULL, " +
                "`currentPage` INTEGER NOT NULL, " +
                "`clientUpdatedAt` INTEGER NOT NULL, " +
                "`syncedUpdatedAt` INTEGER, " +
                "PRIMARY KEY(`mangaId`, `volumeNumber`))",
        )
    }
}

/**
 * v2 (CH.7 progress) → v3 (CH.8/5.1 downloads). Purely additive: creates `download_queue` and leaves
 * `manga`/`volume`/`progress` (pins + reading position) untouched. SQL is verbatim from Room's
 * exported `3.json` so [androidx.room.testing.MigrationTestHelper] validates the result exactly.
 */
val MIGRATION_2_3 = object : Migration(2, 3) {
    override fun migrate(db: SupportSQLiteDatabase) {
        db.execSQL(
            "CREATE TABLE IF NOT EXISTS `download_queue` (" +
                "`mangaId` INTEGER NOT NULL, " +
                "`volumeNumber` INTEGER NOT NULL, " +
                "`state` TEXT NOT NULL, " +
                "`bytesDownloaded` INTEGER NOT NULL, " +
                "`totalBytes` INTEGER NOT NULL, " +
                "`errorMessage` TEXT, " +
                "`updatedAt` INTEGER NOT NULL, " +
                "PRIMARY KEY(`mangaId`, `volumeNumber`))",
        )
    }
}
