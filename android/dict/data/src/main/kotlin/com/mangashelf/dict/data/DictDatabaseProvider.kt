package com.mangashelf.dict.data

import android.content.Context
import androidx.sqlite.SQLiteConnection
import androidx.sqlite.driver.bundled.BundledSQLiteDriver
import dagger.hilt.android.qualifiers.ApplicationContext
import java.io.File
import javax.inject.Inject
import javax.inject.Qualifier
import javax.inject.Singleton

/** On-disk location of the working copy of the prebaked dict.db. */
@Qualifier
@Retention(AnnotationRetention.BINARY)
annotation class DictDbFile

/**
 * Owns the single read connection to the prebaked dict.db (CH.2, ~930 MB trim).
 *
 * On first use it copies the packaged asset (`assets/dict/dict.db`) into [dbFile] — a one-time
 * ~20 s flat byte stream (the asset is `noCompress`) — then opens it with the **bundled** SQLite
 * driver (modern SQLite with FTS5 compiled, since API-28 framework SQLite lacks it). Room is not
 * used: it can't model the gloss_fts virtual table and would reject the hand-baked DB (no
 * room_master_table). The DB is read-only at runtime.
 *
 * Tests construct this directly with [dbFile] pointing at an already-present DB to skip the copy.
 */
@Singleton
class DictDatabaseProvider @Inject constructor(
    @ApplicationContext private val context: Context,
    @DictDbFile private val dbFile: File,
) {
    @Volatile
    private var conn: SQLiteConnection? = null

    /** Opens (once) and returns the read connection. Blocking; call off the main thread. */
    fun connection(): SQLiteConnection {
        conn?.let { return it }
        synchronized(this) {
            conn?.let { return it }
            ensureCopied()
            return BundledSQLiteDriver().open(dbFile.absolutePath).also { conn = it }
        }
    }

    private fun ensureCopied() {
        if (dbFile.exists() && dbFile.length() > 0L) return
        dbFile.parentFile?.mkdirs()
        // Copy to a temp file then atomically rename, so a process kill / out-of-space mid-copy of
        // the ~930 MB asset can't leave a truncated file that the length>0 check would accept.
        val tmp = File(dbFile.parentFile, dbFile.name + ".tmp")
        tmp.delete()
        context.assets.open(ASSET).use { input ->
            tmp.outputStream().use { output -> input.copyTo(output) }
        }
        if (!tmp.renameTo(dbFile)) {
            tmp.delete()
            throw IllegalStateException("Failed to install dict.db from asset")
        }
    }

    companion object {
        /** Packaged asset path (sourced from the CH.2 bake; gitignored, dropped in at build). */
        const val ASSET = "dict/dict.db"
    }
}
