package com.mangashelf.reader.ui.downloads

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
import com.mangashelf.reader.data.local.entities.DownloadState
import com.mudita.mmd.components.buttons.ButtonMMD
import com.mudita.mmd.components.text.TextMMD

/** One DownloadsScreen row. [percent] = -1 means indeterminate (queued / unknown length). */
data class DownloadRowUi(
    val mangaId: Int,
    val volumeNumber: Int,
    val title: String,
    val state: DownloadState,
    val percent: Int,
)

/** Route wrapper: binds [DownloadsViewModel] to the stateless screen (CH.8/5.2). */
@Composable
fun DownloadsRoute(
    onBack: () -> Unit,
    viewModel: DownloadsViewModel = hiltViewModel(),
) {
    val rows by viewModel.rows.collectAsState()
    DownloadsScreen(
        rows = rows,
        onCancel = viewModel::cancel,
        onRetry = viewModel::retry,
        onBack = onBack,
    )
}

/**
 * Active + queued + recently-failed downloads with live progress. Active/queued rows offer Cancel;
 * failed rows offer Retry. Stateless for Compose testing.
 */
@Composable
fun DownloadsScreen(
    rows: List<DownloadRowUi>,
    onCancel: (mangaId: Int, volumeNumber: Int) -> Unit,
    onRetry: (mangaId: Int, volumeNumber: Int) -> Unit,
    onBack: () -> Unit,
) {
    Column(Modifier.fillMaxSize().padding(16.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            ButtonMMD(onClick = onBack) { TextMMD("Back") }
            TextMMD("Downloads")
        }
        Spacer(Modifier.height(16.dp))

        if (rows.isEmpty()) {
            TextMMD("No downloads yet.")
        } else {
            LazyColumn(Modifier.fillMaxSize()) {
                items(rows, key = { "${it.mangaId}-${it.volumeNumber}" }) { row ->
                    DownloadRow(row = row, onCancel = onCancel, onRetry = onRetry)
                }
            }
        }
    }
}

@Composable
private fun DownloadRow(
    row: DownloadRowUi,
    onCancel: (Int, Int) -> Unit,
    onRetry: (Int, Int) -> Unit,
) {
    Row(
        Modifier.fillMaxWidth().padding(vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Column {
            TextMMD("${row.title} · Vol ${row.volumeNumber}")
            TextMMD(statusLabel(row))
        }
        when (row.state) {
            DownloadState.FAILED ->
                ButtonMMD(onClick = { onRetry(row.mangaId, row.volumeNumber) }) { TextMMD("Retry") }
            DownloadState.DOWNLOADED ->
                TextMMD("Done")
            else ->
                ButtonMMD(onClick = { onCancel(row.mangaId, row.volumeNumber) }) { TextMMD("Cancel") }
        }
    }
}

private fun statusLabel(row: DownloadRowUi): String = when (row.state) {
    DownloadState.QUEUED -> "Queued"
    DownloadState.DOWNLOADING -> if (row.percent >= 0) "${row.percent}%" else "Downloading…"
    DownloadState.DOWNLOADED -> "On device"
    DownloadState.FAILED -> "Failed"
}
