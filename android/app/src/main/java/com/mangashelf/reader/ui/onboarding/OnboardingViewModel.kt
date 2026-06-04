package com.mangashelf.reader.ui.onboarding

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.mangashelf.reader.data.remote.AuthValidator
import com.mangashelf.reader.data.store.TokenStore
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * 2.3 onboarding. Validates the entered server URL + token against whoami; on success persists them
 * to the [TokenStore] and emits a one-shot [connected] event (the route navigates to Library). On
 * failure it surfaces an error row and persists nothing.
 */
@HiltViewModel
class OnboardingViewModel @Inject constructor(
    private val validator: AuthValidator,
    private val tokenStore: TokenStore,
) : ViewModel() {

    data class UiState(
        val serverUrl: String = "",
        val token: String = "",
        val connecting: Boolean = false,
        val error: String? = null,
    )

    private val _state = MutableStateFlow(UiState())
    val state: StateFlow<UiState> = _state.asStateFlow()

    /** One-shot: emitted once when credentials validate + persist. */
    private val _connected = MutableSharedFlow<Unit>(extraBufferCapacity = 1)
    val connected: SharedFlow<Unit> = _connected.asSharedFlow()

    fun setServerUrl(value: String) {
        _state.value = _state.value.copy(serverUrl = value, error = null)
    }

    fun setToken(value: String) {
        _state.value = _state.value.copy(token = value, error = null)
    }

    fun connect() {
        val current = _state.value
        if (current.connecting) return
        if (current.serverUrl.isBlank() || current.token.isBlank()) {
            _state.value = current.copy(error = "Enter a server URL and an access token.")
            return
        }
        _state.value = current.copy(connecting = true, error = null)
        viewModelScope.launch {
            validator.validate(current.serverUrl, current.token).fold(
                onSuccess = {
                    tokenStore.save(current.serverUrl, current.token)
                    _state.value = _state.value.copy(connecting = false)
                    _connected.tryEmit(Unit)
                },
                onFailure = {
                    _state.value = _state.value.copy(
                        connecting = false,
                        error = "Could not connect. Check the URL and token.",
                    )
                },
            )
        }
    }
}
