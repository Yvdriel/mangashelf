package com.mangashelf.reader.sync

import android.content.Context
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import androidx.work.workDataOf
import com.mangashelf.reader.data.local.DownloadDao
import com.mangashelf.reader.data.local.entities.DownloadEntity
import com.mangashelf.reader.data.local.entities.DownloadState
import com.mangashelf.reader.data.reader.ArchivePaths
import com.mangashelf.reader.data.remote.MangaShelfApi
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import okhttp3.ResponseBody
import java.io.File
import java.io.IOException

/**
 * CH.8/5.1: streams a pinned volume's CBZ to the exact path the reader opens
 * ([ArchivePaths.cbz] = `filesDir/archives/<mangaId>/v<volumeNumber>.cbz`). Unique work per volume,
 * enqueued/cancelled by [com.mangashelf.reader.data.repo.DownloadRepository] from the pin toggle.
 *
 * Atomicity: bytes land in a `.part` temp and are renamed onto the final path only on full success,
 * so the reader (which opens the CBZ eagerly) never sees a half-file — the other half of the CH.7
 * crash fix (the reader's error path is in `ReaderViewModel`).
 *
 * Resume: a mid-download network drop surfaces as [IOException] → [Result.retry]; WorkManager re-runs
 * under the `CONNECTED` constraint when connectivity returns and the stream restarts from scratch
 * (the `/v1` archive endpoint builds the zip in memory and serves no Range, so restart — not byte
 * resume — is the correct recovery). Live byte progress is published via `WorkInfo.progress`.
 */
@HiltWorker
class DownloadVolumeWorker @AssistedInject constructor(
    @Assisted appContext: Context,
    @Assisted params: WorkerParameters,
    private val api: MangaShelfApi,
    private val downloadDao: DownloadDao,
) : CoroutineWorker(appContext, params) {

    override suspend fun doWork(): Result {
        val mangaId = inputData.getInt(KEY_MANGA_ID, -1)
        val volumeNumber = inputData.getInt(KEY_VOLUME_NUMBER, -1)
        if (mangaId < 0 || volumeNumber < 0) return Result.failure()

        val cbz = ArchivePaths.cbz(applicationContext.filesDir, mangaId, volumeNumber)
        upsert(mangaId, volumeNumber, DownloadState.DOWNLOADING)

        return try {
            val response = api.archive(mangaId, volumeNumber)
            if (!response.isSuccessful) {
                return if (response.code() >= 500) {
                    upsert(mangaId, volumeNumber, DownloadState.QUEUED)
                    Result.retry()
                } else {
                    upsert(mangaId, volumeNumber, DownloadState.FAILED, error = "HTTP ${response.code()}")
                    Result.failure()
                }
            }
            val body = response.body()
                ?: run {
                    upsert(mangaId, volumeNumber, DownloadState.FAILED, error = "empty body")
                    return Result.failure()
                }
            val total = streamToFile(body, cbz, mangaId, volumeNumber)
            downloadSidecar(mangaId, volumeNumber) // O.1 — best-effort, never fails the volume
            upsert(mangaId, volumeNumber, DownloadState.DOWNLOADED, bytes = total, total = total)
            Result.success()
        } catch (e: IOException) {
            // Mid-stream drop: the temp is discarded, the final path is untouched. Retry on reconnect.
            upsert(mangaId, volumeNumber, DownloadState.QUEUED)
            Result.retry()
        } catch (e: Exception) {
            upsert(mangaId, volumeNumber, DownloadState.FAILED, error = e.message)
            Result.failure()
        }
    }

    /**
     * O.1: downloads the `.mokuro` OCR sidecar beside the CBZ. Best-effort — a 404 (volume never
     * OCR'd) or any sidecar error is swallowed so it never fails an otherwise-complete volume.
     */
    private suspend fun downloadSidecar(mangaId: Int, volumeNumber: Int) {
        try {
            val response = api.ocr(mangaId, volumeNumber)
            if (!response.isSuccessful) return // 404 = not OCR'd → skip silently
            val body = response.body() ?: return
            val target = ArchivePaths.mokuro(applicationContext.filesDir, mangaId, volumeNumber)
            streamToFile(body, target, mangaId, volumeNumber)
        } catch (e: Exception) {
            // Sidecar is optional; a network blip here must not fail the volume.
        }
    }

    /** Streams [body] to a `.part` temp, then atomically renames onto [target]. Returns total bytes. */
    private suspend fun streamToFile(
        body: ResponseBody,
        target: File,
        mangaId: Int,
        volumeNumber: Int,
    ): Long {
        target.parentFile?.mkdirs()
        val temp = File(target.parentFile, target.name + PART_SUFFIX)
        val total = body.contentLength()
        var read = 0L
        var lastPublished = -1
        body.byteStream().use { input ->
            temp.outputStream().use { out ->
                val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
                while (true) {
                    val n = input.read(buffer)
                    if (n < 0) break
                    out.write(buffer, 0, n)
                    read += n
                    val pct = DownloadProgress.percent(read, total)
                    if (pct != lastPublished) {
                        lastPublished = pct
                        setProgress(workDataOf(KEY_PROGRESS to pct))
                    }
                }
                out.flush()
            }
        }
        if (!temp.renameTo(target)) {
            // Cross-filesystem fallback (same filesDir in practice, so rename normally wins).
            temp.copyTo(target, overwrite = true)
            temp.delete()
        }
        return if (total > 0) total else read
    }

    private suspend fun upsert(
        mangaId: Int,
        volumeNumber: Int,
        state: DownloadState,
        bytes: Long = 0,
        total: Long = 0,
        error: String? = null,
    ) = downloadDao.upsert(
        DownloadEntity(
            mangaId = mangaId,
            volumeNumber = volumeNumber,
            state = state,
            bytesDownloaded = bytes,
            totalBytes = total,
            errorMessage = error,
            updatedAt = System.currentTimeMillis(),
        ),
    )

    companion object {
        const val KEY_MANGA_ID = "mangaId"
        const val KEY_VOLUME_NUMBER = "volumeNumber"
        const val KEY_PROGRESS = "progress"
        private const val PART_SUFFIX = ".part"

        fun uniqueName(mangaId: Int, volumeNumber: Int): String = "download-$mangaId-v$volumeNumber"
    }
}
