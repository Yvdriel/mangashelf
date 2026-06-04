package com.mangashelf.reader.data.repo

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.workDataOf
import com.mangashelf.reader.data.local.DownloadDao
import com.mangashelf.reader.data.local.entities.DownloadEntity
import com.mangashelf.reader.data.local.entities.DownloadState
import com.mangashelf.reader.data.reader.ArchivePaths
import com.mangashelf.reader.sync.DownloadVolumeWorker
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import java.io.File
import java.util.concurrent.TimeUnit
import javax.inject.Inject
import javax.inject.Singleton

/**
 * CH.8/5.1: drives the per-volume [DownloadVolumeWorker] from the MangaDetail pin toggle. Pinning
 * [enqueue]s unique work (CONNECTED-gated, exponential backoff so an offline pin downloads on the
 * next reconnect); unpinning [cancel]s it and deletes the on-disk CBZ + `.mokuro` sidecar (O.1).
 */
@Singleton
class DownloadRepository @Inject constructor(
    @ApplicationContext private val context: Context,
    private val workManager: WorkManager,
    private val downloadDao: DownloadDao,
) {

    fun observeDownloads(): Flow<List<DownloadEntity>> = downloadDao.observeAll()

    suspend fun enqueue(mangaId: Int, volumeNumber: Int) {
        downloadDao.upsert(
            DownloadEntity(
                mangaId = mangaId,
                volumeNumber = volumeNumber,
                state = DownloadState.QUEUED,
                updatedAt = System.currentTimeMillis(),
            ),
        )
        val request = OneTimeWorkRequestBuilder<DownloadVolumeWorker>()
            .setInputData(
                workDataOf(
                    DownloadVolumeWorker.KEY_MANGA_ID to mangaId,
                    DownloadVolumeWorker.KEY_VOLUME_NUMBER to volumeNumber,
                ),
            )
            .setConstraints(
                Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build(),
            )
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
            .addTag(TAG)
            .addTag(volTag(mangaId, volumeNumber)) // lets the UI match WorkInfo progress to a row
            .build()
        // KEEP: re-pinning an in-flight volume must not restart it from scratch.
        workManager.enqueueUniqueWork(
            DownloadVolumeWorker.uniqueName(mangaId, volumeNumber),
            ExistingWorkPolicy.KEEP,
            request,
        )
    }

    suspend fun cancel(mangaId: Int, volumeNumber: Int) {
        workManager.cancelUniqueWork(DownloadVolumeWorker.uniqueName(mangaId, volumeNumber))
        val cbz = ArchivePaths.cbz(context.filesDir, mangaId, volumeNumber)
        cbz.delete()
        File(cbz.parentFile, cbz.name + ".part").delete()
        ArchivePaths.mokuro(context.filesDir, mangaId, volumeNumber).delete()
        downloadDao.delete(mangaId, volumeNumber)
    }

    companion object {
        const val TAG = "volume-download"

        fun volTag(mangaId: Int, volumeNumber: Int): String = "vol-$mangaId-$volumeNumber"
    }
}
