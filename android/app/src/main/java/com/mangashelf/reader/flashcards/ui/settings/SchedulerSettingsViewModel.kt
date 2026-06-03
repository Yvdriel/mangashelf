package com.mangashelf.reader.flashcards.ui.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.mangashelf.reader.flashcards.data.CollectionRepository
import com.mangashelf.reader.flashcards.data.model.SchedulerSettings
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * F.5 scheduler settings. Loads the single global [SchedulerSettings] preset from the backend,
 * edits it locally via [copy], and persists it on [save]. [saved] flips true briefly after a
 * successful write so the UI can surface a confirmation.
 */
@HiltViewModel
class SchedulerSettingsViewModel @Inject constructor(
    private val repo: CollectionRepository,
) : ViewModel() {

    private val _settings = MutableStateFlow(SchedulerSettings.DEFAULT)
    val settings: StateFlow<SchedulerSettings> = _settings.asStateFlow()

    /** Flips true briefly after a successful save, then back to false. */
    private val _saved = MutableStateFlow(false)
    val saved: StateFlow<Boolean> = _saved.asStateFlow()

    init {
        viewModelScope.launch {
            _settings.value = repo.schedulerSettings()
        }
    }

    fun setRollover(hour: Int) {
        _settings.value = _settings.value.copy(rolloverHour = hour)
    }

    fun setNewPerDay(value: Int) {
        _settings.value = _settings.value.copy(newPerDay = value)
    }

    fun setReviewsPerDay(value: Int) {
        _settings.value = _settings.value.copy(reviewsPerDay = value)
    }

    fun setFsrsEnabled(enabled: Boolean) {
        _settings.value = _settings.value.copy(fsrsEnabled = enabled)
    }

    fun setDesiredRetention(value: Float) {
        _settings.value = _settings.value.copy(desiredRetention = value)
    }

    fun save() {
        viewModelScope.launch {
            repo.updateSchedulerSettings(_settings.value)
            _saved.value = true
            _saved.value = false
        }
    }
}
