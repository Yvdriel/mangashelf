package com.mangashelf.reader.dict.ui.radical

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.mangashelf.dict.data.DictEngine
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * UI state for the radical-search screen (D2.6).
 *
 * @param byStroke radicals grouped by stroke count, ascending (each group's radicals in DB order).
 * @param selected the set of currently chosen radicals (intersection filter).
 * @param matched kanji containing ALL [selected] radicals; empty when nothing is selected.
 */
data class RadicalUiState(
    val byStroke: List<Pair<Int, List<String>>> = emptyList(),
    val selected: Set<String> = emptySet(),
    val matched: List<String> = emptyList(),
)

/**
 * Backs the radical-search grid: loads the full radical set (grouped by stroke count) once, then
 * recomputes the kanji intersection each time a radical is toggled. Stays thin — all dictionary
 * logic lives in [DictEngine].
 */
@HiltViewModel
class RadicalViewModel @Inject constructor(
    private val engine: DictEngine,
) : ViewModel() {

    private val _state = MutableStateFlow(RadicalUiState())
    val state: StateFlow<RadicalUiState> = _state.asStateFlow()

    init {
        viewModelScope.launch {
            val rads = engine.radicals()
            val grouped = rads.groupBy { it.strokes ?: 0 }
                .toSortedMap()
                .map { (strokes, list) -> strokes to list.map { it.radical } }
            _state.value = _state.value.copy(byStroke = grouped)
        }
    }

    /** Add/remove [r] from the selection and refresh the kanji intersection. */
    fun toggle(r: String) {
        viewModelScope.launch {
            val sel = _state.value.selected.toMutableSet().apply { if (!add(r)) remove(r) }
            val matched = if (sel.isEmpty()) emptyList() else engine.kanjiByRadicals(sel)
            _state.value = _state.value.copy(selected = sel, matched = matched)
        }
    }
}
