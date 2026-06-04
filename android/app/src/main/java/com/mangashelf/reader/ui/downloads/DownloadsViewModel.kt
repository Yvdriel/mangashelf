package com.mangashelf.reader.ui.downloads

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.work.WorkInfo
import androidx.work.WorkManager
import com.mangashelf.reader.data.local.MangaDao
import com.mangashelf.reader.data.local.entities.DownloadState
import com.mangashelf.reader.data.repo.DownloadRepository
import com.mangashelf.reader.data.repo.LibraryRepository
import com.mangashelf.reader.sync.DownloadProgress
import com.mangashelf.reader.sync.DownloadVolumeWorker
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * CH.8/5.2: merges the durable `download_queue` rows with live `WorkInfo.progress` (matched by the
 * per-volume tag) and manga titles into the DownloadsScreen list. Cancel unpins + removes the volume;
 * Retry re-enqueues the worker.
 */
@HiltViewModel
class DownloadsViewModel @Inject constructor(
    private val downloads: DownloadRepository,
    private val library: LibraryRepository,
    private val mangaDao: MangaDao,
    private val workManager: WorkManager,
) : ViewModel() {

    val rows: StateFlow<List<DownloadRowUi>> = combine(
        downloads.observeDownloads(),
        workManager.getWorkInfosByTagFlow(DownloadRepository.TAG),
        mangaDao.observeLibrary(),
    ) { entities, infos, libraryRows ->
        val titles = libraryRows.associate { it.manga.id to it.manga.title }
        entities.map { e ->
            val tag = DownloadRepository.volTag(e.mangaId, e.volumeNumber)
            val livePercent = infos
                .firstOrNull { tag in it.tags && it.state == WorkInfo.State.RUNNING }
                ?.progress?.getInt(DownloadVolumeWorker.KEY_PROGRESS, -1) ?: -1
            DownloadRowUi(
                mangaId = e.mangaId,
                volumeNumber = e.volumeNumber,
                title = titles[e.mangaId] ?: "Manga ${e.mangaId}",
                state = e.state,
                percent = when {
                    e.state == DownloadState.DOWNLOADED -> 100
                    livePercent >= 0 -> livePercent
                    else -> DownloadProgress.percent(e.bytesDownloaded, e.totalBytes)
                },
            )
        }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    /** Stop + forget a download. Unpins so a later sync doesn't silently re-download it. */
    fun cancel(mangaId: Int, volumeNumber: Int) {
        viewModelScope.launch {
            library.setPinned(mangaId, volumeNumber, false)
            downloads.cancel(mangaId, volumeNumber)
        }
    }

    fun retry(mangaId: Int, volumeNumber: Int) {
        viewModelScope.launch { downloads.enqueue(mangaId, volumeNumber) }
    }
}
