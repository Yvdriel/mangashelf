package com.mangashelf.reader.ui.reader

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.mangashelf.reader.data.reader.PageDirection
import com.mangashelf.reader.data.reader.PageSource
import com.mangashelf.reader.data.reader.PageSourceFactory
import com.mangashelf.reader.data.repo.ProgressRepository
import com.mangashelf.reader.ui.nav.Routes
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import javax.inject.Inject

/**
 * Drives the paged reader (CH.7 4.2). On open it resolves the CBZ via [PageSourceFactory], resumes
 * the locally stored page, and decodes off the main thread. Every page change persists progress
 * locally ([ProgressRepository]) so reopening returns to the same page; CH.8/5.3 pushes it later.
 * Hardware volume keys arrive through [ReaderKeyBus] and map to the same prev/next actions.
 */
@HiltViewModel
class ReaderViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val progress: ProgressRepository,
    private val pageSourceFactory: PageSourceFactory,
    private val keyBus: ReaderKeyBus,
) : ViewModel() {

    private val mangaId: Int = savedStateHandle[Routes.READER_ARG_MANGA_ID] ?: 0
    private val volumeNumber: Int = savedStateHandle[Routes.READER_ARG_VOLUME] ?: 0

    private var source: PageSource? = null

    private val _state = MutableStateFlow(ReaderUiState(pageIndex = 0, pageCount = 0, bitmap = null, topBarVisible = false))
    val state: StateFlow<ReaderUiState> = _state

    init {
        keyBus.readerActive = true
        viewModelScope.launch {
            val resume = progress.resumePage(mangaId, volumeNumber)
            val opened = withContext(Dispatchers.IO) { pageSourceFactory.create(mangaId, volumeNumber) }
            source = opened
            val last = (opened.pageCount - 1).coerceAtLeast(0)
            showPage(resume.coerceIn(0, last))
        }
        viewModelScope.launch {
            keyBus.keys.collect { direction ->
                when (direction) {
                    PageDirection.Next -> next()
                    PageDirection.Prev -> prev()
                }
            }
        }
    }

    fun next() {
        val src = source ?: return
        val target = (_state.value.pageIndex + 1).coerceAtMost(src.pageCount - 1)
        if (target != _state.value.pageIndex) viewModelScope.launch { showPage(target) }
    }

    fun prev() {
        if (source == null) return
        val target = (_state.value.pageIndex - 1).coerceAtLeast(0)
        if (target != _state.value.pageIndex) viewModelScope.launch { showPage(target) }
    }

    fun toggleBar() {
        _state.value = _state.value.copy(topBarVisible = !_state.value.topBarVisible)
    }

    /** Enter zoom — wired in 4.3. */
    fun enterZoom() {}

    /** OCR-block lookup seam — no-op until CH.9 / O.2. */
    fun onOcrBlockDoubleTap() {}

    private suspend fun showPage(index: Int) {
        val src = source ?: return
        val bitmap = withContext(Dispatchers.IO) { src.page(index) }
        _state.value = _state.value.copy(pageIndex = index, pageCount = src.pageCount, bitmap = bitmap)
        progress.write(mangaId, volumeNumber, index)
    }

    override fun onCleared() {
        keyBus.readerActive = false
        source?.close()
    }
}
