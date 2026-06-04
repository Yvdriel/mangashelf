package com.mangashelf.reader.ui.reader

import android.graphics.Rect
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.mangashelf.reader.data.reader.PageDirection
import com.mangashelf.reader.data.reader.PageSource
import com.mangashelf.reader.data.reader.PageSourceFactory
import com.mangashelf.reader.data.reader.SwipeDirection
import com.mangashelf.reader.data.reader.ZoomGrid
import com.mangashelf.reader.data.reader.ZoomState
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
 * Drives the paged reader (CH.7 4.2) and the 9-position zoom (4.3). On open it resolves the CBZ via
 * [PageSourceFactory], resumes the locally stored page, and decodes off the main thread; every page
 * change persists progress locally ([ProgressRepository]) so reopening returns to the same page
 * (CH.8/5.3 pushes it later). Hardware volume keys arrive through [ReaderKeyBus].
 *
 * Zoom renders a full-resolution [ZoomGrid] cell via [PageSource.decodeRegion]; while zoomed,
 * page-turn and the OCR double-tap seam are inert (only swipe-to-move or back-to-full). Exactly one
 * region bitmap is alive at a time — the previous one is recycled on every move and on exit.
 */
@HiltViewModel
class ReaderViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val progress: ProgressRepository,
    private val pageSourceFactory: PageSourceFactory,
    private val keyBus: ReaderKeyBus,
) : ViewModel() {

    private val mangaId: Int = checkNotNull(savedStateHandle[Routes.READER_ARG_MANGA_ID]) {
        "Reader requires a ${Routes.READER_ARG_MANGA_ID} nav argument"
    }
    private val volumeNumber: Int = checkNotNull(savedStateHandle[Routes.READER_ARG_VOLUME]) {
        "Reader requires a ${Routes.READER_ARG_VOLUME} nav argument"
    }

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
        if (_state.value.zoom is ZoomState.Zoom) return // page-turn disabled while zoomed
        val src = source ?: return
        val target = (_state.value.pageIndex + 1).coerceAtMost(src.pageCount - 1)
        if (target != _state.value.pageIndex) viewModelScope.launch { showPage(target) }
    }

    fun prev() {
        if (_state.value.zoom is ZoomState.Zoom) return
        if (source == null) return
        val target = (_state.value.pageIndex - 1).coerceAtLeast(0)
        if (target != _state.value.pageIndex) viewModelScope.launch { showPage(target) }
    }

    fun toggleBar() {
        _state.value = _state.value.copy(topBarVisible = !_state.value.topBarVisible)
    }

    fun enterZoom() {
        if (_state.value.zoom is ZoomState.Zoom || source == null) return
        val zoom = ZoomState.FullView.enter() as ZoomState.Zoom
        _state.value = _state.value.copy(zoom = zoom)
        viewModelScope.launch { decodeRegion(zoom.position) }
    }

    fun onZoomSwipe(direction: SwipeDirection) {
        val current = _state.value.zoom
        if (current !is ZoomState.Zoom) return
        val moved = current.onSwipe(direction)
        if (moved == current) return // clamped at an edge — nothing to redraw
        _state.value = _state.value.copy(zoom = moved)
        viewModelScope.launch { decodeRegion(moved.position) }
    }

    fun exitZoom() {
        if (_state.value.zoom !is ZoomState.Zoom) return
        val previous = _state.value.regionBitmap
        _state.value = _state.value.copy(zoom = ZoomState.FullView, regionBitmap = null)
        previous?.let { if (!it.isRecycled) it.recycle() }
    }

    /** OCR-block lookup seam — no-op until CH.9 / O.2. */
    fun onOcrBlockDoubleTap() {}

    private suspend fun showPage(index: Int) {
        val src = source ?: return
        val bitmap = withContext(Dispatchers.IO) { src.page(index) }
        _state.value = _state.value.copy(pageIndex = index, pageCount = src.pageCount, bitmap = bitmap)
        progress.write(mangaId, volumeNumber, index)
    }

    private suspend fun decodeRegion(position: Int) {
        val src = source ?: return
        val pageIndex = _state.value.pageIndex
        val region = withContext(Dispatchers.IO) {
            val bounds = src.pageBounds(pageIndex)
            val cell = ZoomGrid.cellRect(position, bounds.width, bounds.height)
            src.decodeRegion(pageIndex, Rect(cell.left, cell.top, cell.right, cell.bottom))
        }
        val previous = _state.value.regionBitmap
        _state.value = _state.value.copy(regionBitmap = region)
        previous?.let { if (!it.isRecycled) it.recycle() }
    }

    override fun onCleared() {
        keyBus.readerActive = false
        _state.value.regionBitmap?.let { if (!it.isRecycled) it.recycle() }
        source?.close()
    }
}
