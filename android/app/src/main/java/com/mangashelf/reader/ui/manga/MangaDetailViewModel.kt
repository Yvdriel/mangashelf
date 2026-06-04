package com.mangashelf.reader.ui.manga

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.mangashelf.reader.data.local.MangaWithVolumes
import com.mangashelf.reader.data.repo.DownloadRepository
import com.mangashelf.reader.data.repo.LibraryRepository
import com.mangashelf.reader.ui.nav.Routes
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * 3.4 manga detail. Streams one manga (with volumes) from Room by the `mangaId` nav arg and toggles
 * the per-volume pin (the downloads/reader hinge), which persists via the repository. CH.8/5.1: the
 * pin now actually drives the download — pinning enqueues [DownloadRepository.enqueue]; unpinning
 * cancels it and deletes the cached files.
 */
@HiltViewModel
class MangaDetailViewModel @Inject constructor(
    private val repository: LibraryRepository,
    private val downloads: DownloadRepository,
    savedStateHandle: SavedStateHandle,
) : ViewModel() {

    private val mangaId: Int = checkNotNull(savedStateHandle[Routes.MANGA_ID_ARG]) {
        "MangaDetail requires a ${Routes.MANGA_ID_ARG} nav argument"
    }

    val state: StateFlow<MangaWithVolumes?> =
        repository.observeManga(mangaId)
            .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)

    fun togglePin(volumeNumber: Int, currentlyPinned: Boolean) {
        val nowPinned = !currentlyPinned
        viewModelScope.launch {
            repository.setPinned(mangaId, volumeNumber, nowPinned)
            if (nowPinned) downloads.enqueue(mangaId, volumeNumber)
            else downloads.cancel(mangaId, volumeNumber)
        }
    }
}
