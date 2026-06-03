package com.mangashelf.reader.flashcards.ui.stats

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.runtime.collectAsState
import androidx.hilt.navigation.compose.hiltViewModel
import com.mudita.mmd.components.buttons.ButtonMMD
import com.mudita.mmd.components.text.TextMMD

// Intensity-bucket thresholds (inclusive lower bound of each non-zero bucket).
private const val BUCKET1_MIN = 1   // 1..3   reviews
private const val BUCKET2_MIN = 4   // 4..9   reviews
private const val BUCKET3_MIN = 10  // 10..24 reviews
private const val BUCKET4_MIN = 25  // 25+    reviews

/**
 * Maps a single day's review [count] to an intensity bucket 0..4:
 * 0 → 0, 1..3 → 1, 4..9 → 2, 10..24 → 3, 25+ → 4. Pure and testable (no Compose/Android).
 */
fun bucket(count: Int): Int = when {
    count >= BUCKET4_MIN -> 4
    count >= BUCKET3_MIN -> 3
    count >= BUCKET2_MIN -> 2
    count >= BUCKET1_MIN -> 1
    else -> 0
}

// Grayscale shades per bucket (e-ink high contrast): bucket 0 very light gray → bucket 4 black.
private val BUCKET_COLORS = listOf(
    Color(0xFFEDEDED), // 0 — empty / very light gray
    Color(0xFFBDBDBD), // 1
    Color(0xFF888888), // 2
    Color(0xFF454545), // 3
    Color(0xFF000000), // 4 — black
)

private const val DAYS_PER_WEEK = 7
private const val DEFAULT_FIRST_OFFSET = -363 // ~52 weeks back, inclusive of today (0)
private val CELL_SIZE = 12.dp
private val CELL_GAP = 2.dp

/** Route wrapper: binds the Hilt [HeatmapViewModel] to the stateless [HeatmapScreen]. */
@Composable
fun HeatmapRoute(
    onBack: () -> Unit,
    viewModel: HeatmapViewModel = hiltViewModel(),
) {
    val reviewsByDay by viewModel.reviewsByDay.collectAsState()
    HeatmapScreen(reviewsByDay = reviewsByDay, onBack = onBack)
}

/**
 * F.6 Anki-style calendar heatmap. Columns are weeks, rows are the 7 weekday cells. Each day offset
 * (0 = today, negative = past) is placed into its week column by integer-dividing the offset by 7,
 * and colored by [bucket]. The row of week-columns scrolls horizontally. Stateless for testing.
 */
@Composable
fun HeatmapScreen(
    reviewsByDay: Map<Int, Int>,
    onBack: () -> Unit,
) {
    val firstOffset = minOf(DEFAULT_FIRST_OFFSET, reviewsByDay.keys.minOrNull() ?: 0)

    // Week index 0 is the oldest week; today's week is the largest index. floorDiv keeps negative
    // offsets grouped correctly (e.g. -7..-1 share a week distinct from 0..-6's "today" week).
    val firstWeek = Math.floorDiv(firstOffset, DAYS_PER_WEEK)
    val lastWeek = Math.floorDiv(0, DAYS_PER_WEEK) // == 0
    val weekCount = lastWeek - firstWeek + 1

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            TextMMD("Reviews")
            ButtonMMD(onClick = onBack) { TextMMD("Back") }
        }
        Spacer(Modifier.height(16.dp))

        Row(
            modifier = Modifier.horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(CELL_GAP),
        ) {
            for (week in 0 until weekCount) {
                Column(verticalArrangement = Arrangement.spacedBy(CELL_GAP)) {
                    for (weekday in 0 until DAYS_PER_WEEK) {
                        val offset = (firstWeek + week) * DAYS_PER_WEEK + weekday
                        // Future days (offset > 0) never occur within range; clamp defensively.
                        val count = if (offset <= 0) reviewsByDay[offset] ?: 0 else 0
                        DayCell(BUCKET_COLORS[bucket(count)])
                    }
                }
            }
        }
    }
}

@Composable
private fun DayCell(color: Color) {
    Box(
        modifier = Modifier
            .size(CELL_SIZE)
            .background(color),
    )
}
