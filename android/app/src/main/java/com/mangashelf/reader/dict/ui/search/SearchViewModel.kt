package com.mangashelf.reader.dict.ui.search

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.mangashelf.dict.data.DictEngine
import com.mangashelf.dict.data.model.TermHit
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/** UI state for the D2.2 unified search box. */
data class SearchUiState(
    val query: String = "",
    val results: List<TermHit> = emptyList(),
    val loading: Boolean = false,
)

/**
 * D2.2 search screen VM. Each keystroke updates [SearchUiState.query] immediately, then a
 * debounced (~250ms) job runs the unified [DictEngine.search] (romaji/kana/kanji/wildcard/English
 * + `#tag` filters). A blank query short-circuits to empty results.
 */
@HiltViewModel
class SearchViewModel @Inject constructor(
    private val engine: DictEngine,
) : ViewModel() {

    private val _state = MutableStateFlow(SearchUiState())
    val state: StateFlow<SearchUiState> = _state.asStateFlow()

    private var searchJob: Job? = null

    fun onQueryChange(query: String) {
        // Reflect the typed text right away so the field stays responsive.
        _state.value = _state.value.copy(query = query)
        searchJob?.cancel()

        if (query.isBlank()) {
            _state.value = _state.value.copy(results = emptyList(), loading = false)
            return
        }

        _state.value = _state.value.copy(loading = true)
        searchJob = viewModelScope.launch {
            delay(DEBOUNCE_MS)
            val results = engine.search(query)
            _state.value = _state.value.copy(results = results, loading = false)
        }
    }

    private companion object {
        const val DEBOUNCE_MS = 250L
    }
}
