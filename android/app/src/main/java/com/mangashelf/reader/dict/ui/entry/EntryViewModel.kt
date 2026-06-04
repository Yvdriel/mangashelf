package com.mangashelf.reader.dict.ui.entry

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.mangashelf.dict.data.DictEngine
import com.mangashelf.dict.data.model.EntryDetail
import com.mangashelf.dict.engine.ConjugationTable
import com.mangashelf.dict.engine.rulesToConditions
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/** D2.3 entry-detail UI state. Loaded carries the resolved detail plus an optional forward
 *  conjugation table (only present for conjugatable headwords with non-empty groups). */
sealed interface EntryUiState {
    data object Loading : EntryUiState
    data object NotFound : EntryUiState
    data class Loaded(val detail: EntryDetail, val conjugation: ConjugationTable?) : EntryUiState
}

@HiltViewModel
class EntryViewModel @Inject constructor(
    private val engine: DictEngine,
    savedStateHandle: SavedStateHandle,
) : ViewModel() {

    private val sequence = savedStateHandle.get<Int>("sequence") ?: 0

    private val _state = MutableStateFlow<EntryUiState>(EntryUiState.Loading)
    val state: StateFlow<EntryUiState> = _state.asStateFlow()

    init {
        viewModelScope.launch {
            val d = engine.entry(sequence)
            if (d == null) {
                _state.value = EntryUiState.NotFound
            } else {
                // Conjugate the primary alt form (if any), keyed on its POS rule mask.
                val primary = d.altForms.firstOrNull()
                val mask = primary?.let { rulesToConditions(it.rules) } ?: 0
                val conj = if (mask != 0 && primary != null) {
                    engine.conjugate(primary.expression, mask)
                } else {
                    null
                }
                _state.value = EntryUiState.Loaded(d, conj?.takeIf { it.groups.isNotEmpty() })
            }
        }
    }
}
