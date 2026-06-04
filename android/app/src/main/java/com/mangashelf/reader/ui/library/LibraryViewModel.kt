package com.mangashelf.reader.ui.library

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.mangashelf.reader.data.local.MangaWithVolumes
import com.mangashelf.reader.data.repo.LibraryRepository
import com.mangashelf.reader.data.store.TokenStore
import com.mangashelf.reader.sync.LibrarySync
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import javax.inject.Inject

/** Library UI state — observed from Room, so it reflects the cache even offline. */
sealed interface LibraryUiState {
    data object Loading : LibraryUiState
    data object Empty : LibraryUiState
    data class Content(val manga: List<MangaWithVolumes>) : LibraryUiState
}

/**
 * 3.3 library. Streams the Room-backed library into [state], ensures the 6-hour periodic sync is
 * scheduled, and kicks a one-shot sync on entry so the list is fresh. [serverUrl] is read once to
 * build cover URLs.
 */
@HiltViewModel
class LibraryViewModel @Inject constructor(
    repository: LibraryRepository,
    private val librarySync: LibrarySync,
    tokenStore: TokenStore,
) : ViewModel() {

    val serverUrl: String? = tokenStore.serverUrl()

    val state: StateFlow<LibraryUiState> =
        repository.observeLibrary()
            .map { if (it.isEmpty()) LibraryUiState.Empty else LibraryUiState.Content(it) }
            .stateIn(
                scope = viewModelScope,
                started = SharingStarted.WhileSubscribed(5_000),
                initialValue = LibraryUiState.Loading,
            )

    init {
        librarySync.enqueuePeriodic()
        librarySync.refreshNow()
    }

    fun refresh() = librarySync.refreshNow()
}
