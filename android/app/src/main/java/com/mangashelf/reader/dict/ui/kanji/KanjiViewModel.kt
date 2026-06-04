package com.mangashelf.reader.dict.ui.kanji

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.mangashelf.dict.data.DictEngine
import com.mangashelf.dict.data.model.KanjiDetail
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/** UI state for the kanji-detail screen (D2.4). */
sealed interface KanjiUiState {
    data object Loading : KanjiUiState
    data object NotFound : KanjiUiState
    data class Loaded(val detail: KanjiDetail) : KanjiUiState
}

/**
 * Backs the kanji-detail screen: reads the target character from the nav arg ("char"), fetches the
 * KANJIDIC2 detail once via [DictEngine.kanji], and exposes Loading / NotFound / Loaded. Stays thin
 * — all dictionary logic lives in [DictEngine].
 */
@HiltViewModel
class KanjiViewModel @Inject constructor(
    private val engine: DictEngine,
    savedStateHandle: SavedStateHandle,
) : ViewModel() {

    private val ch: String = savedStateHandle.get<String>("char") ?: ""

    private val _state = MutableStateFlow<KanjiUiState>(KanjiUiState.Loading)
    val state: StateFlow<KanjiUiState> = _state.asStateFlow()

    init {
        viewModelScope.launch {
            val d = engine.kanji(ch)
            _state.value = if (d == null) KanjiUiState.NotFound else KanjiUiState.Loaded(d)
        }
    }
}
