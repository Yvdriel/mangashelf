package com.mangashelf.reader.ocr

import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.layout
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import kotlin.math.roundToInt

const val OCR_OVERLAY_TAG = "ocr-overlay"

/** testTag for the block at original index [idx] (stable across the area-sort). */
fun ocrBlockTag(idx: Int): String = "ocr-block-$idx"

/**
 * O.2 native OCR overlay: a transparent, absolutely-positioned layer of per-block tappable boxes
 * scaled onto the displayed page (`ContentScale.Fit`). Mirrors `src/components/ocr-overlay.tsx`
 * but in Compose: **double-tap** a block → [onBlockSelect]; there is **no** long-press alias
 * (long-press stays reserved for the reader zoom). When [onBlockSelect] is null the blocks carry no
 * gesture (used while zoomed / overlay hidden). Larger blocks are placed first so a smaller block
 * nested on top is composed last and wins hit-testing.
 *
 * Must overlay a sibling Image of the same size; empty areas carry no pointer input so taps there
 * fall through to the reader's page-turn gesture. No early `return` (Compose group-stack safety).
 */
@Composable
fun OcrOverlay(
    page: MokuroPage,
    modifier: Modifier = Modifier,
    onBlockSelect: ((MokuroBlock, Int) -> Unit)? = null,
    debugVisible: Boolean = false,
) {
    BoxWithConstraints(modifier.fillMaxSize().testTag(OCR_OVERLAY_TAG)) {
        if (page.blocks.isNotEmpty() && page.imgWidth > 0 && page.imgHeight > 0) {
            val fitted = OverlayScale.fittedRect(
                containerW = constraints.maxWidth.toFloat(),
                containerH = constraints.maxHeight.toFloat(),
                imgW = page.imgWidth,
                imgH = page.imgHeight,
            )
            // Largest first → smallest composed last → smallest wins overlapping hit-tests.
            val ordered = page.blocks.withIndex().sortedByDescending { (_, b) ->
                val box = b.box
                if (box.size < 4) 0L else (box[2] - box[0]).toLong() * (box[3] - box[1])
            }
            ordered.forEach { (idx, block) ->
                if (block.box.size >= 4) {
                    val r = OverlayScale.blockToScreen(block.box, fitted)
                    OcrBlockBox(
                        rect = r,
                        tag = ocrBlockTag(idx),
                        debugVisible = debugVisible,
                        onDoubleTap = onBlockSelect?.let { sel -> { sel(block, idx) } },
                    )
                }
            }
        }
    }
}

@Composable
private fun OcrBlockBox(
    rect: ScreenRect,
    tag: String,
    debugVisible: Boolean,
    onDoubleTap: (() -> Unit)?,
) {
    val w = rect.width().roundToInt().coerceAtLeast(1)
    val h = rect.height().roundToInt().coerceAtLeast(1)
    val left = rect.left.roundToInt()
    val top = rect.top.roundToInt()
    var m = Modifier
        // Place at the absolute on-screen rect in px (fixed size + offset), independent of flow.
        .layout { measurable, _ ->
            val placeable = measurable.measure(androidx.compose.ui.unit.Constraints.fixed(w, h))
            layout(placeable.width, placeable.height) { placeable.place(IntOffset(left, top)) }
        }
        .testTag(tag)
    if (onDoubleTap != null) {
        m = m.pointerInput(tag) { detectTapGestures(onDoubleTap = { onDoubleTap() }) }
    }
    if (debugVisible) {
        m = m.border(1.dp, Color.Red)
    }
    androidx.compose.foundation.layout.Box(m)
}
