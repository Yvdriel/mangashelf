package com.mangashelf.reader.ui.library

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.horizontalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.mangashelf.reader.data.local.MangaWithVolumes
import com.mangashelf.reader.ui.common.CoverImage
import com.mudita.mmd.components.buttons.ButtonMMD
import com.mudita.mmd.components.text.TextMMD

/** Route wrapper: binds [LibraryViewModel] and forwards nav callbacks (CH.4 3.3). */
@Composable
fun LibraryRoute(
    onOpenManga: (Int) -> Unit,
    onDownloads: () -> Unit,
    onSettings: () -> Unit,
    viewModel: LibraryViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsState()
    LibraryScreen(
        state = state,
        serverUrl = viewModel.serverUrl,
        onOpenManga = onOpenManga,
        onRefresh = viewModel::refresh,
        onDownloads = onDownloads,
        onSettings = onSettings,
    )
}

/**
 * Library list: a row per manga (cover + title + volume count). Covers load via Coil over the authed
 * client. Stateless so it can be Compose-tested without Hilt. This is the Reader section of the
 * 3-section shell (D3.3); the Flashcards entries moved to the Flashcards section.
 */
@Composable
fun LibraryScreen(
    state: LibraryUiState,
    serverUrl: String?,
    onOpenManga: (Int) -> Unit,
    onRefresh: () -> Unit,
    onDownloads: () -> Unit,
    onSettings: () -> Unit,
) {
    Column(Modifier.fillMaxSize().padding(16.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            TextMMD("Library")
            ButtonMMD(onClick = onRefresh) { TextMMD("Sync") }
        }
        Spacer(Modifier.height(8.dp))
        Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState())) {
            ButtonMMD(onClick = onDownloads) { TextMMD("Downloads") }
            Spacer(Modifier.width(8.dp))
            ButtonMMD(onClick = onSettings) { TextMMD("Settings") }
        }
        Spacer(Modifier.height(16.dp))

        when (state) {
            LibraryUiState.Loading -> TextMMD("Loading…")
            LibraryUiState.Empty -> Column {
                TextMMD("No manga yet.")
                Spacer(Modifier.height(8.dp))
                TextMMD("Pull your library with Sync.")
            }
            is LibraryUiState.Content -> LazyColumn(Modifier.fillMaxSize()) {
                items(state.manga, key = { it.manga.id }) { entry ->
                    MangaRow(
                        entry = entry,
                        coverUrl = coverUrl(serverUrl, entry),
                        onClick = { onOpenManga(entry.manga.id) },
                    )
                }
            }
        }
    }
}

@Composable
private fun MangaRow(
    entry: MangaWithVolumes,
    coverUrl: String?,
    onClick: () -> Unit,
) {
    Row(
        Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        CoverImage(
            coverUrl = coverUrl,
            contentDescription = entry.manga.title,
            modifier = Modifier.size(width = 56.dp, height = 80.dp),
        )
        Spacer(Modifier.width(12.dp))
        Column {
            TextMMD(entry.manga.title)
            Spacer(Modifier.height(4.dp))
            TextMMD("${entry.volumes.size} volumes")
        }
    }
}

/** Cover URL for [entry], or null when the manga has no cover (→ placeholder). */
private fun coverUrl(serverUrl: String?, entry: MangaWithVolumes): String? =
    if (serverUrl != null && entry.manga.coverImage != null) {
        "$serverUrl/api/v1/manga/${entry.manga.id}/cover?size=sm"
    } else {
        null
    }
