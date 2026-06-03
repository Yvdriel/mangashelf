package com.mangashelf.reader.flashcards.ui.importexport

import android.content.Context
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.mudita.mmd.components.buttons.ButtonMMD
import com.mudita.mmd.components.text.TextMMD
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.io.File

/**
 * F.7 stateless import/export UI. Three actions (full backup, deck export, import) plus a status
 * line reflecting [status]. Stateless so it can be Compose-tested without Hilt.
 */
@Composable
fun ImportExportScreen(
    status: IoStatus,
    onExportColpkg: () -> Unit,
    onExportApkg: () -> Unit,
    onPickImport: () -> Unit,
    onBack: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        verticalArrangement = Arrangement.Center,
    ) {
        ButtonMMD(onClick = onExportColpkg, modifier = Modifier.fillMaxWidth()) {
            TextMMD("Export .colpkg (full backup)")
        }
        Spacer(Modifier.height(16.dp))
        ButtonMMD(onClick = onExportApkg, modifier = Modifier.fillMaxWidth()) {
            TextMMD("Export .apkg (deck)")
        }
        Spacer(Modifier.height(16.dp))
        ButtonMMD(onClick = onPickImport, modifier = Modifier.fillMaxWidth()) {
            TextMMD("Import…")
        }
        Spacer(Modifier.height(24.dp))
        TextMMD(status.statusLine())
        Spacer(Modifier.height(16.dp))
        ButtonMMD(onClick = onBack, modifier = Modifier.fillMaxWidth()) {
            TextMMD("Back")
        }
    }
}

private fun IoStatus.statusLine(): String = when (this) {
    IoStatus.Idle -> "Ready"
    is IoStatus.Working -> msg
    is IoStatus.Done -> msg
    is IoStatus.Error -> "Error: $msg"
}

/**
 * Route wrapper: binds the Hilt [ImportExportViewModel] to [ImportExportScreen]. Exports write to
 * the app external files dir (reachable over USB/MTP/Mudita Center) and surface the path via the
 * status line. Import picks a file with SAF, copies the content stream into the cache dir (rslib
 * needs a real file path), then hands the temp path to the ViewModel.
 */
@Composable
fun ImportExportRoute(
    onBack: () -> Unit,
    viewModel: ImportExportViewModel = hiltViewModel(),
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val status by viewModel.status.collectAsState()

    // External files dir can be null when external storage is unavailable; fall back to app-private.
    val exportDir = remember(context) { context.getExternalFilesDir(null) ?: context.filesDir }
    val colpkgOut = remember(exportDir) { File(exportDir, "mangashelf-export.colpkg").absolutePath }
    val apkgOut = remember(exportDir) { File(exportDir, "mangashelf-export.apkg").absolutePath }

    val importLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.OpenDocument(),
    ) { uri: Uri? ->
        if (uri != null) {
            // Copy the picked content off the main thread — .colpkg files can be large.
            scope.launch(Dispatchers.IO) {
                val isColpkg = displayName(context, uri).endsWith(".colpkg")
                val tempName = if (isColpkg) "import.colpkg" else "import.apkg"
                val tempPath = File(context.cacheDir, tempName).absolutePath
                copyToFile(context, uri, tempPath)
                viewModel.importFile(tempPath, isColpkg = isColpkg)
            }
        }
    }

    ImportExportScreen(
        status = status,
        onExportColpkg = { viewModel.exportColpkg(colpkgOut) },
        onExportApkg = { viewModel.exportApkg(apkgOut) },
        onPickImport = { importLauncher.launch(arrayOf("*/*")) },
        onBack = onBack,
    )
}

/** Best-effort file name for the picked [uri]; falls back to the Uri's last path segment. */
private fun displayName(context: Context, uri: Uri): String {
    context.contentResolver.query(uri, null, null, null, null)?.use { cursor ->
        val nameIndex = cursor.getColumnIndex(android.provider.OpenableColumns.DISPLAY_NAME)
        if (nameIndex >= 0 && cursor.moveToFirst()) {
            cursor.getString(nameIndex)?.let { return it }
        }
    }
    return uri.lastPathSegment ?: ""
}

/** Copies the content stream behind [uri] into [destPath]. Call off the main thread (blocking I/O). */
private fun copyToFile(context: Context, uri: Uri, destPath: String) {
    context.contentResolver.openInputStream(uri)?.use { input ->
        File(destPath).outputStream().use { output ->
            input.copyTo(output)
        }
    }
}
