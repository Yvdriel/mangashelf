package com.mangashelf.reader.ui.common

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import coil.compose.AsyncImage

/**
 * A manga cover. Coil uses the app singleton [coil.ImageLoader] (the authed OkHttp client), so the
 * bearer token is attached automatically. [coverUrl] null — or a 404/decode failure — falls back to
 * the flat placeholder box, which keeps the row layout stable on e-ink.
 */
@Composable
fun CoverImage(
    coverUrl: String?,
    contentDescription: String?,
    modifier: Modifier = Modifier,
) {
    Box(modifier.background(PLACEHOLDER)) {
        if (coverUrl != null) {
            AsyncImage(
                model = coverUrl,
                contentDescription = contentDescription,
                contentScale = ContentScale.Crop,
                modifier = Modifier.matchParentSize(),
            )
        }
    }
}

private val PLACEHOLDER = Color(0xFFE8E8E8)
