package com.mangashelf.reader.ui.reader

import android.graphics.Bitmap
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import com.mangashelf.reader.data.reader.ReaderGestures
import com.mangashelf.reader.data.reader.SwipeDirection
import com.mangashelf.reader.data.reader.TapZone
import com.mangashelf.reader.data.reader.ZoomState
import com.mudita.mmd.components.buttons.ButtonMMD
import com.mudita.mmd.components.text.TextMMD

/** Presentational reader state. [zoom] drives the FullView↔Zoom render; [regionBitmap] is the cell. */
data class ReaderUiState(
    val pageIndex: Int,
    val pageCount: Int,
    val bitmap: Bitmap?,
    val topBarVisible: Boolean,
    val zoom: ZoomState = ZoomState.FullView,
    val regionBitmap: Bitmap? = null,
)

const val READER_SURFACE_TAG = "reader-surface"

private const val SWIPE_THRESHOLD_PX = 48f

/**
 * Stateless paged reader (CH.7 4.2/4.3). FullView: tap zones (LEFT=prev / RIGHT=next / thin
 * TOP-CENTER=toggle bar), long-press enters zoom, double-tap is the OCR-lookup seam (no-op, CH.9),
 * single-tap debounced behind the double-tap timeout. Zoom: page-turn + OCR seam are DISABLED; only
 * a directional swipe (snap to neighbour cell) or back-to-full. Stateless for Compose testing; no
 * early `return` — guard with if/else.
 */
@Composable
fun ReaderScreen(
    state: ReaderUiState,
    onPrev: () -> Unit,
    onNext: () -> Unit,
    onToggleBar: () -> Unit,
    onEnterZoom: () -> Unit,
    onOcrBlockDoubleTap: () -> Unit,
    onBack: () -> Unit,
    onZoomSwipe: (SwipeDirection) -> Unit = {},
    onExitZoom: () -> Unit = {},
) {
    val zoom = state.zoom
    Box(
        Modifier
            .fillMaxSize()
            .background(Color.White)
            .testTag(READER_SURFACE_TAG),
    ) {
        if (zoom is ZoomState.Zoom) {
            ZoomLayer(regionBitmap = state.regionBitmap, position = zoom.position, onZoomSwipe = onZoomSwipe)
            BackHandler { onExitZoom() } // back exits zoom to the same page
        } else {
            FullPageLayer(
                state = state,
                onPrev = onPrev,
                onNext = onNext,
                onToggleBar = onToggleBar,
                onEnterZoom = onEnterZoom,
                onOcrBlockDoubleTap = onOcrBlockDoubleTap,
                onBack = onBack,
            )
            BackHandler { onBack() }
        }
    }
}

@Composable
private fun FullPageLayer(
    state: ReaderUiState,
    onPrev: () -> Unit,
    onNext: () -> Unit,
    onToggleBar: () -> Unit,
    onEnterZoom: () -> Unit,
    onOcrBlockDoubleTap: () -> Unit,
    onBack: () -> Unit,
) {
    Box(
        Modifier.fillMaxSize().pointerInput(Unit) {
            detectTapGestures(
                // onTap fires only after the double-tap timeout, so a double-tap never also flips.
                onTap = { offset ->
                    when (ReaderGestures.zoneFor(offset.x, offset.y, size.width.toFloat(), size.height.toFloat())) {
                        TapZone.Prev -> onPrev()
                        TapZone.Next -> onNext()
                        TapZone.ToggleBar -> onToggleBar()
                    }
                },
                onDoubleTap = { onOcrBlockDoubleTap() }, // OCR-lookup seam (CH.9 / O.2)
                onLongPress = { onEnterZoom() },
            )
        },
    ) {
        val bmp = state.bitmap
        if (bmp != null) {
            Image(
                bitmap = bmp.asImageBitmap(),
                contentDescription = "page ${state.pageIndex + 1} of ${state.pageCount}",
                contentScale = ContentScale.Fit,
                modifier = Modifier.fillMaxSize(),
            )
        } else {
            TextMMD("Loading…")
        }

        if (state.topBarVisible) {
            Row(
                Modifier.fillMaxWidth().padding(12.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                ButtonMMD(onClick = onBack) { TextMMD("Back") }
                TextMMD("${state.pageIndex + 1} / ${state.pageCount}")
            }
        }
    }
}

@Composable
private fun ZoomLayer(
    regionBitmap: Bitmap?,
    position: Int,
    onZoomSwipe: (SwipeDirection) -> Unit,
) {
    Box(
        Modifier.fillMaxSize().pointerInput(position) {
            var dx = 0f
            var dy = 0f
            detectDragGestures(
                onDragStart = { dx = 0f; dy = 0f },
                onDrag = { change, drag -> change.consume(); dx += drag.x; dy += drag.y },
                // Snap to the neighbour cell in the swiped direction — no continuous panning.
                onDragEnd = { SwipeDirection.dominant(dx, dy, SWIPE_THRESHOLD_PX)?.let(onZoomSwipe) },
            )
        },
    ) {
        if (regionBitmap != null) {
            Image(
                bitmap = regionBitmap.asImageBitmap(),
                contentDescription = "zoom cell $position",
                contentScale = ContentScale.Fit,
                modifier = Modifier.fillMaxSize(),
            )
        } else {
            TextMMD("Loading…")
        }
    }
}
