package com.mangashelf.reader.sync

import android.content.Context
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.mangashelf.reader.data.remote.MangaShelfApi
import com.mangashelf.reader.data.repo.LibraryRepository
import com.mangashelf.reader.data.store.SyncStateStore
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject

/**
 * 3.2: pulls the library delta and persists it. Reads the [SyncStateStore] cursor (null on first
 * run → full pull), applies the response to the [LibraryRepository], then advances the cursor to the
 * response's `serverTime`. A second run with no server-side changes returns an empty delta and is a
 * no-op. Network/transport failures return [Result.retry] so WorkManager backs off and retries.
 */
@HiltWorker
class LibraryDeltaWorker @AssistedInject constructor(
    @Assisted appContext: Context,
    @Assisted params: WorkerParameters,
    private val api: MangaShelfApi,
    private val repository: LibraryRepository,
    private val syncState: SyncStateStore,
) : CoroutineWorker(appContext, params) {

    override suspend fun doWork(): Result = try {
        val response = api.library(changedSince = syncState.lastSyncedAt())
        repository.applyDelta(response)
        syncState.setLastSyncedAt(response.serverTime)
        Result.success()
    } catch (e: Exception) {
        Result.retry()
    }
}
