package com.mangashelf.reader.sync

import android.content.Context
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.mangashelf.reader.data.local.ProgressDao
import com.mangashelf.reader.data.remote.MangaShelfApi
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import retrofit2.HttpException
import java.io.IOException

/**
 * CH.8/5.3: pushes dirty local reading progress to `/v1/progress/batch` as one batch (debounced 5s by
 * [ProgressSyncScheduler]). On a 200 every acknowledged row clears its dirty flag via the pushed
 * `clientUpdatedAt` (accepted = stored server-side; rejected = stale → cleared without retry). A
 * transient failure (IO / 5xx) retries; a 4xx (revoked token) fails fast — the 401 → onboarding
 * recovery is handled at the UI layer (6.2).
 */
@HiltWorker
class SyncProgressWorker @AssistedInject constructor(
    @Assisted appContext: Context,
    @Assisted params: WorkerParameters,
    private val api: MangaShelfApi,
    private val progressDao: ProgressDao,
) : CoroutineWorker(appContext, params) {

    override suspend fun doWork(): Result = try {
        val dirty = progressDao.selectDirty()
        if (dirty.isEmpty()) {
            Result.success()
        } else {
            val result = api.pushProgress(ProgressSync.toBatchRequest(dirty))
            ProgressSync.marks(dirty, result).forEach {
                progressDao.markSynced(it.mangaId, it.volumeNumber, it.syncedUpdatedAt)
            }
            Result.success()
        }
    } catch (e: HttpException) {
        if (e.code() >= 500) Result.retry() else Result.failure()
    } catch (e: IOException) {
        Result.retry()
    } catch (e: Exception) {
        Result.failure()
    }
}
