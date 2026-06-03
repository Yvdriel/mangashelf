package com.mangashelf.reader.flashcards.ui.stats

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.mangashelf.reader.flashcards.data.CollectionRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * F.6 calendar-heatmap state holder. Loads the per-day review counts once on creation and exposes
 * them as a [StateFlow] keyed by day offset (0 = today, negative = days in the past).
 */
@HiltViewModel
class HeatmapViewModel @Inject constructor(
    private val repo: CollectionRepository,
) : ViewModel() {

    private val _reviewsByDay = MutableStateFlow<Map<Int, Int>>(emptyMap())
    val reviewsByDay: StateFlow<Map<Int, Int>> = _reviewsByDay.asStateFlow()

    init {
        viewModelScope.launch {
            _reviewsByDay.value = repo.reviewsByDay()
        }
    }
}
