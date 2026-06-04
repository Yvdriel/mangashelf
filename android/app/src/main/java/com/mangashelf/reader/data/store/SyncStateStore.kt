package com.mangashelf.reader.data.store

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

private val Context.syncDataStore by preferencesDataStore(name = "sync_state")

/**
 * Persists the library delta cursor. [lastSyncedAt] (unix seconds) is the server time of the last
 * successful sync and becomes the next `changedSince`; null means "never synced → full pull".
 */
@Singleton
class SyncStateStore @Inject constructor(
    @ApplicationContext private val context: Context,
) {
    private val store = context.syncDataStore

    suspend fun lastSyncedAt(): Long? = store.data.map { it[KEY] }.first()

    suspend fun setLastSyncedAt(value: Long) {
        store.edit { it[KEY] = value }
    }

    /** Resets the cursor (Clear Cache / test isolation) so the next sync is a full pull. */
    suspend fun clear() {
        store.edit { it.remove(KEY) }
    }

    private companion object {
        val KEY = longPreferencesKey("last_synced_at")
    }
}
