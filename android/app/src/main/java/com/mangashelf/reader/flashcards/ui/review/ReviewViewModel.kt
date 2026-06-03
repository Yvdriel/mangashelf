package com.mangashelf.reader.flashcards.ui.review

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.mangashelf.reader.flashcards.data.CollectionRepository
import com.mangashelf.reader.flashcards.data.model.Rating
import com.mangashelf.reader.flashcards.data.model.ReviewCard
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.io.File
import javax.inject.Inject

sealed interface ReviewUiState {
    data object Loading : ReviewUiState
    data object Empty : ReviewUiState
    data class Reviewing(val card: ReviewCard, val answerShown: Boolean) : ReviewUiState
}

@HiltViewModel
class ReviewViewModel @Inject constructor(
    private val repo: CollectionRepository,
) : ViewModel() {

    private val _state = MutableStateFlow<ReviewUiState>(ReviewUiState.Loading)
    val state: StateFlow<ReviewUiState> = _state.asStateFlow()

    private var deckId: Long = 0L

    init {
        viewModelScope.launch {
            deckId = repo.bootstrap()
            loadNext()
        }
    }

    fun showAnswer() {
        val current = _state.value
        if (current is ReviewUiState.Reviewing) {
            _state.value = current.copy(answerShown = true)
        }
    }

    fun answer(rating: Rating) {
        val current = _state.value as? ReviewUiState.Reviewing ?: return
        viewModelScope.launch {
            repo.answer(current.card.cardId, rating)
            repo.refreshDecks()
            loadNext()
        }
    }

    /** Resolves an Image-field filename to its media file for rendering. */
    fun imageFile(filename: String): File = repo.imageFile(filename)

    private suspend fun loadNext() {
        val card = repo.nextCard(deckId)
        _state.value = if (card == null) ReviewUiState.Empty else ReviewUiState.Reviewing(card, answerShown = false)
    }
}
