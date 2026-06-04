package com.mangashelf.reader.ui.reader

import android.graphics.Bitmap
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
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
import com.mangashelf.reader.data.reader.TapZone
import com.mudita.mmd.components.buttons.ButtonMMD
import com.mudita.mmd.components.text.TextMMD

/** Presentational reader state for the current full-page view (zoom is layered on in 4.3). */
data class ReaderUiState(
    val pageIndex: Int,
    val pageCount: Int,
    val bitmap: Bitmap?,
    val topBarVisible: Boolean,
)

const val READER_SURFACE_TAG = "reader-surface"

/**
 * Stateless paged reader (CH.7 4.2). Tap zones (LEFT=prev / RIGHT=next / thin TOP-CENTER=toggle bar)
 * are resolved by [com.mangashelf.reader.data.reader.ReaderGestures]; long-press enters zoom (4.3);
 * double-tap is the OCR-lookup seam wired no-op for CH.9. Stateless so it is Compose-testable with
 * fixtures (mirrors MangaDetailScreen / ReviewScreen). No early `return` — guard with if/else.
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
) {
    Box(
        Modifier
            .fillMaxSize()
            .background(Color.White)
            .testTag(READER_SURFACE_TAG)
            .pointerInput(Unit) {
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
