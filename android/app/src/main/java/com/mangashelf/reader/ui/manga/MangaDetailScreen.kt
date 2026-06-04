package com.mangashelf.reader.ui.manga

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.mangashelf.reader.data.local.MangaWithVolumes
import com.mangashelf.reader.data.local.entities.VolumeEntity
import com.mudita.mmd.components.buttons.ButtonMMD
import com.mudita.mmd.components.text.TextMMD

/** Route wrapper: binds [MangaDetailViewModel] to the stateless screen (CH.4 3.4). */
@Composable
fun MangaDetailRoute(
    onRead: (volumeNumber: Int) -> Unit,
    onBack: () -> Unit,
    viewModel: MangaDetailViewModel = hiltViewModel(),
) {
    val manga by viewModel.state.collectAsState()
    MangaDetailScreen(
        manga = manga,
        onTogglePin = viewModel::togglePin,
        onRead = onRead,
        onBack = onBack,
    )
}

/**
 * Lists a manga's volumes, each with a status pill (pinned state) and a pin/unpin toggle. Pinning
 * persists to Room (the hinge consumed by downloads in CH.5 / reader in CH.7). Stateless for testing.
 */
@Composable
fun MangaDetailScreen(
    manga: MangaWithVolumes?,
    onTogglePin: (volumeNumber: Int, currentlyPinned: Boolean) -> Unit,
    onRead: (volumeNumber: Int) -> Unit,
    onBack: () -> Unit,
) {
    Column(Modifier.fillMaxSize().padding(16.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            ButtonMMD(onClick = onBack) { TextMMD("Back") }
            // Opens the lowest-numbered volume; per-volume rows open a specific volume.
            val firstVolume = manga?.volumes?.minByOrNull { it.volumeNumber }?.volumeNumber
            ButtonMMD(onClick = { firstVolume?.let(onRead) }) { TextMMD("Read") }
        }
        Spacer(Modifier.height(16.dp))

        // No early return from a composable lambda — that imbalances Compose's group stack.
        if (manga == null) {
            TextMMD("Loading…")
        } else {
            TextMMD(manga.manga.title)
            Spacer(Modifier.height(12.dp))

            LazyColumn(Modifier.fillMaxSize()) {
                items(manga.volumes.sortedBy { it.volumeNumber }, key = { it.volumeNumber }) { volume ->
                    VolumeRow(volume = volume, onTogglePin = onTogglePin, onRead = onRead)
                }
            }
        }
    }
}

@Composable
private fun VolumeRow(
    volume: VolumeEntity,
    onTogglePin: (Int, Boolean) -> Unit,
    onRead: (Int) -> Unit,
) {
    Row(
        Modifier.fillMaxWidth().padding(vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            TextMMD("Vol ${volume.volumeNumber}")
            Spacer(Modifier.width(12.dp))
            TextMMD(if (volume.pinned) "[Pinned]" else "[Available]")
        }
        Row(verticalAlignment = Alignment.CenterVertically) {
            ButtonMMD(onClick = { onRead(volume.volumeNumber) }) { TextMMD("Read") }
            Spacer(Modifier.width(8.dp))
            ButtonMMD(onClick = { onTogglePin(volume.volumeNumber, volume.pinned) }) {
                TextMMD(if (volume.pinned) "Unpin" else "Pin")
            }
        }
    }
}
