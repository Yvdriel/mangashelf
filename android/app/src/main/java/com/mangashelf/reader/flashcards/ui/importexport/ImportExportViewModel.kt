package com.mangashelf.reader.flashcards.ui.importexport

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.mangashelf.reader.flashcards.data.CollectionRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/** UI-facing status of the current import/export operation. */
sealed interface IoStatus {
    data object Idle : IoStatus
    data class Working(val msg: String) : IoStatus
    data class Done(val msg: String) : IoStatus
    data class Error(val msg: String) : IoStatus
}

/**
 * F.7 import / export. Thin wrapper over [CollectionRepository]'s suspend colpkg/apkg operations,
 * surfacing a single [IoStatus] flow. The screen passes real file paths (rslib needs file paths,
 * not content Uris): export targets live under the app external files dir, imports are copied from
 * the picked SAF Uri into the cache dir by the Composable before calling [importFile].
 */
@HiltViewModel
class ImportExportViewModel @Inject constructor(
    private val repo: CollectionRepository,
) : ViewModel() {

    private val _status = MutableStateFlow<IoStatus>(IoStatus.Idle)
    val status: StateFlow<IoStatus> = _status.asStateFlow()

    /** Full collection + revlog backup to [outPath] (a `.colpkg`). */
    fun exportColpkg(outPath: String) = run("Exporting full backup…") {
        repo.exportColpkg(outPath)
        IoStatus.Done("Exported to: $outPath")
    }

    /** Deck-share export to [outPath] (an `.apkg`). */
    fun exportApkg(outPath: String) = run("Exporting deck…") {
        repo.exportApkg(outPath)
        IoStatus.Done("Exported to: $outPath")
    }

    /**
     * Imports the file already copied to [srcPath]. [isColpkg] selects whole-collection replace
     * (`.colpkg`) vs. additive deck import (`.apkg`).
     */
    fun importFile(srcPath: String, isColpkg: Boolean) =
        run(if (isColpkg) "Restoring backup…" else "Importing deck…") {
            if (isColpkg) repo.importColpkg(srcPath) else repo.importApkg(srcPath)
            IoStatus.Done("Imported")
        }

    private fun run(working: String, op: suspend () -> IoStatus) {
        viewModelScope.launch {
            _status.value = IoStatus.Working(working)
            _status.value = try {
                op()
            } catch (e: Exception) {
                IoStatus.Error(e.message ?: "Operation failed")
            }
        }
    }
}
