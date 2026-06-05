package com.mangashelf.reader.ui.reader

import android.graphics.Bitmap
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
import com.mangashelf.dict.data.DictEngine
import com.mangashelf.dict.data.model.TermHit
import com.mangashelf.reader.data.repo.ProgressRepository
import com.mangashelf.reader.ocr.MokuroBlock
import com.mangashelf.reader.ocr.MokuroDoc
import com.mangashelf.reader.ocr.MokuroSourceFactory
import com.mangashelf.reader.ocr.OcrCardMiner
import com.mangashelf.reader.ocr.OverlayScale
import com.mangashelf.reader.ocr.pageFor
import com.mangashelf.reader.ui.nav.Routes
import dagger.hilt.android.lifecycle.HiltViewModel
import java.io.ByteArrayOutputStream
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
    private val mokuroSourceFactory: MokuroSourceFactory,
    private val cardMiner: OcrCardMiner,
    private val dictEngine: DictEngine,
    private val keyBus: ReaderKeyBus,
) : ViewModel() {

    private val mangaId: Int = checkNotNull(savedStateHandle[Routes.READER_ARG_MANGA_ID]) {
        "Reader requires a ${Routes.READER_ARG_MANGA_ID} nav argument"
    }
    private val volumeNumber: Int = checkNotNull(savedStateHandle[Routes.READER_ARG_VOLUME]) {
        "Reader requires a ${Routes.READER_ARG_VOLUME} nav argument"
    }

    private var source: PageSource? = null

    /** Parsed `.mokuro` for this volume (null when no sidecar / unparsable → overlay simply off). */
    private var mokuro: MokuroDoc? = null

    private val _state = MutableStateFlow(ReaderUiState(pageIndex = 0, pageCount = 0, bitmap = null, topBarVisible = false))
    val state: StateFlow<ReaderUiState> = _state

    init {
        keyBus.readerActive = true
        viewModelScope.launch {
            try {
                val resume = progress.resumePage(mangaId, volumeNumber)
                val opened = withContext(Dispatchers.IO) { pageSourceFactory.create(mangaId, volumeNumber) }
                source = opened
                mokuro = withContext(Dispatchers.IO) { mokuroSourceFactory.load(mangaId, volumeNumber) }
                val last = (opened.pageCount - 1).coerceAtLeast(0)
                showPage(resume.coerceIn(0, last))
            } catch (e: Exception) {
                // Missing or corrupt archive (e.g. an absent/partial download): ZipFile ctor or a
                // page decode threw. Surface an error state instead of crashing (CH.8/5.1).
                _state.value = _state.value.copy(error = OPEN_ERROR)
            }
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

    /** Reader-settings toggle for the OCR overlay (mirrors the web show/hide), like [toggleBar]. */
    fun toggleOverlay() {
        _state.value = _state.value.copy(overlayVisible = !_state.value.overlayVisible)
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

    /**
     * OCR-block selection seam (double-tap on an overlay block). Opens the lookup popup with the
     * block's text immediately, then crops the page region natively (O.3) off-thread for the card
     * image. D3.1 fills the dictionary lookup; D3.2 the mining definition.
     */
    fun onOcrBlockSelected(block: MokuroBlock, idx: Int) {
        val src = source ?: return
        val ocrPage = _state.value.ocrPage ?: return
        if (_state.value.zoom is ZoomState.Zoom) return // inert while zoomed
        val sentence = block.lines.joinToString("")
        val pageIndex = _state.value.pageIndex
        // Recycle a still-open popup's crop before replacing it (selecting block→block must not leak).
        val staleImage = _state.value.ocrPopup?.image
        _state.value = _state.value.copy(ocrPopup = OcrPopupState(sentence = sentence, loading = true))
        staleImage?.let { if (!it.isRecycled) it.recycle() }
        viewModelScope.launch {
            // D3.1: deinflect/look up the bubble text → dictionary entries (conjugated/romaji/kana/
            // kanji all resolve via scan()). Local; no network.
            val results = try {
                dictEngine.scan(sentence)
            } catch (e: Exception) {
                emptyList()
            }
            val cur = _state.value.ocrPopup
            if (cur != null && cur.sentence == sentence) {
                _state.value = _state.value.copy(ocrPopup = cur.copy(results = results, loading = false))
            }
        }
        viewModelScope.launch {
            // Native crop from the local CBZ page — replaces the web /api/anki/capture + sharp path.
            val crop = try {
                withContext(Dispatchers.IO) {
                    val bounds = src.pageBounds(pageIndex)
                    val cell = OverlayScale.cropRectSource(
                        box = block.box,
                        paddingPx = CROP_PADDING_PX,
                        imgW = ocrPage.imgWidth,
                        imgH = ocrPage.imgHeight,
                        pageW = bounds.width,
                        pageH = bounds.height,
                    )
                    src.decodeRegion(pageIndex, Rect(cell.left, cell.top, cell.right, cell.bottom))
                }
            } catch (e: Exception) {
                null
            }
            val current = _state.value.ocrPopup
            if (current != null && current.sentence == sentence) {
                _state.value = _state.value.copy(ocrPopup = current.copy(image = crop))
            } else {
                crop?.let { if (!it.isRecycled) it.recycle() } // popup changed/closed mid-crop
            }
        }
    }

    /** Closes the lookup popup and recycles the crop bitmap. */
    fun onDismissPopup() {
        val previous = _state.value.ocrPopup?.image
        _state.value = _state.value.copy(ocrPopup = null)
        previous?.let { if (!it.isRecycled) it.recycle() }
    }

    /**
     * Mines the current popup as a flashcard via the F.8 seam — which adds into the **Mining
     * notetype** (Sentence/Image/Definition/Source), so the review back renders (a non-Mining note
     * would render blank below the divider; CH.9 NOTE). D3.2: when a resolved [hit] is given, its
     * `cardBackHtml(hit, senseIndex)` becomes the Definition field; otherwise the card is
     * sentence + image only.
     */
    fun onCreateCard(hit: TermHit?, senseIndex: Int? = null) {
        val popup = _state.value.ocrPopup ?: return
        val pageIndex = _state.value.pageIndex
        val definitionHtml = hit?.let { dictEngine.cardBackHtml(it, senseIndex) }
        viewModelScope.launch {
            // Compress off the main thread (e-ink CPU is slow); mining itself hops to IO internally.
            val bytes = popup.image?.let { withContext(Dispatchers.IO) { compressJpeg(it) } }
            cardMiner.mine(
                sentence = popup.sentence,
                imageBytes = bytes,
                imageFilename = "ocr_${mangaId}_v${volumeNumber}_p${pageIndex + 1}_${System.nanoTime()}.jpg",
                definitionHtml = definitionHtml,
                source = "manga $mangaId · vol $volumeNumber · p${pageIndex + 1}",
                tags = emptyList(),
            )
            val current = _state.value.ocrPopup
            if (current != null) _state.value = _state.value.copy(ocrPopup = current.copy(status = SAVED_STATUS))
        }
    }

    private fun compressJpeg(bitmap: Bitmap): ByteArray =
        ByteArrayOutputStream().use { out ->
            bitmap.compress(Bitmap.CompressFormat.JPEG, 85, out)
            out.toByteArray()
        }

    private suspend fun showPage(index: Int) {
        val src = source ?: return
        val bitmap = try {
            withContext(Dispatchers.IO) { src.page(index) }
        } catch (e: Exception) {
            _state.value = _state.value.copy(error = OPEN_ERROR)
            return
        }
        // Map the page to its mokuro blocks by CBZ entry name (positional fallback) for the overlay.
        val ocrPage = mokuro?.pageFor(index, src.entryName(index))
        _state.value = _state.value.copy(
            pageIndex = index,
            pageCount = src.pageCount,
            bitmap = bitmap,
            ocrPage = ocrPage,
        )
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
        _state.value.ocrPopup?.image?.let { if (!it.isRecycled) it.recycle() }
        source?.close()
    }

    private companion object {
        const val OPEN_ERROR = "Couldn't open this volume. It may be missing or still downloading — try re-pinning it."

        /** Padding (source px) added around an OCR box when cropping the card image. */
        const val CROP_PADDING_PX = 12
        const val SAVED_STATUS = "Saved to Mining"
    }
}
