package com.mangashelf.reader.sync

import android.content.Context
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.mangashelf.reader.data.local.ProgressDao
import com.mangashelf.reader.data.local.VolumeDao
import com.mangashelf.reader.data.remote.MangaShelfApi
import com.mangashelf.reader.data.repo.LibraryRepository
import com.mangashelf.reader.data.store.SyncStateStore
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import retrofit2.HttpException
import java.io.IOException

/**
 * 3.2 + CH.8/5.4: pulls the library delta, then pulls the progress delta and reconciles it
 * last-write-wins. Reads the [SyncStateStore] cursors (null on first run → full pull) and advances
 * each on success. Library is pulled first so volumes exist to resolve the server's `volumeId` →
 * client volumeNumber during the progress merge.
 *
 * Retry policy: transient I/O / 5xx → [Result.retry]; a 4xx (e.g. 401/403 revoked token) →
 * [Result.failure] (retry would just burn backoff). Token-revocation recovery is handled at the UI
 * layer (6.2).
 */
@HiltWorker
class LibraryDeltaWorker @AssistedInject constructor(
    @Assisted appContext: Context,
    @Assisted params: WorkerParameters,
    private val api: MangaShelfApi,
    private val repository: LibraryRepository,
    private val progressDao: ProgressDao,
    private val volumeDao: VolumeDao,
    private val syncState: SyncStateStore,
) : CoroutineWorker(appContext, params) {

    override suspend fun doWork(): Result = try {
        val response = api.library(changedSince = syncState.lastSyncedAt())
        repository.applyDelta(response)
        syncState.setLastSyncedAt(response.serverTime)
        pullProgress()
        Result.success()
    } catch (e: HttpException) {
        if (e.code() >= 500) Result.retry() else Result.failure()
    } catch (e: IOException) {
        Result.retry()
    } catch (e: Exception) {
        Result.failure()
    }

    /** Pull progress changed since the cursor and apply LWW per row (CH.8/5.4). */
    private suspend fun pullProgress() {
        val pull = api.getProgress(changedSince = syncState.lastProgressSyncedAt())
        for (server in pull.progress) {
            val volumeNumber = volumeDao.findVolumeNumber(server.mangaId, server.volumeId) ?: continue
            val local = progressDao.get(server.mangaId, volumeNumber)
            val outcome = ProgressMerge.reconcile(
                local = local,
                mangaId = server.mangaId,
                volumeNumber = volumeNumber,
                serverCurrentPage = server.currentPage,
                serverUpdatedAtSeconds = server.updatedAt,
            )
            if (outcome is MergeOutcome.Overwrite) progressDao.upsert(outcome.entity)
        }
        syncState.setLastProgressSyncedAt(pull.serverTime)
    }
}
