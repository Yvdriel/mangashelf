package com.mangashelf.reader.data.reader

import kotlin.math.abs

/** Swipe direction for moving the zoom focus one cell. */
enum class SwipeDirection {
    Left, Right, Up, Down;

    companion object {
        /** Dominant-axis direction of a drag, or null if neither axis clears [threshold]. */
        fun dominant(dx: Float, dy: Float, threshold: Float): SwipeDirection? = when {
            abs(dx) < threshold && abs(dy) < threshold -> null
            abs(dx) >= abs(dy) -> if (dx < 0) Left else Right
            else -> if (dy < 0) Up else Down
        }
    }
}

/**
 * Reader zoom state machine (CH.7 4.3). `FullView` ↔ `Zoom(position ∈ 0..8)` over [ZoomGrid]'s 3×3
 * grid. Long-press enters at the centre; a swipe moves the focused cell one step the way you swiped,
 * clamped at the edges (no wrap, no continuous pan); back exits to the same page.
 */
sealed interface ZoomState {

    data object FullView : ZoomState {
        fun enter(): ZoomState = Zoom(4)
    }

    data class Zoom(val position: Int) : ZoomState {

        fun exit(): ZoomState = FullView

        fun onSwipe(direction: SwipeDirection): Zoom {
            var col = position % 3
            var row = position / 3
            when (direction) {
                SwipeDirection.Left -> col = (col - 1).coerceAtLeast(0)
                SwipeDirection.Right -> col = (col + 1).coerceAtMost(2)
                SwipeDirection.Up -> row = (row - 1).coerceAtLeast(0)
                SwipeDirection.Down -> row = (row + 1).coerceAtMost(2)
            }
            return Zoom(row * 3 + col)
        }
    }
}
