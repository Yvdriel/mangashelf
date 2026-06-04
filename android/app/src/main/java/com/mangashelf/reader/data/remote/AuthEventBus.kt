package com.mangashelf.reader.data.remote

import kotlinx.coroutines.channels.BufferOverflow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import javax.inject.Inject
import javax.inject.Singleton

/**
 * App-wide "the token is no longer valid" signal (CH.8/6.2). The [AuthInterceptor] emits on any 401;
 * `MainActivity` collects it and routes back to Onboarding. Downloaded files on disk are untouched —
 * only the credentials are cleared.
 */
@Singleton
class AuthEventBus @Inject constructor() {

    private val _events = MutableSharedFlow<Unit>(extraBufferCapacity = 1, onBufferOverflow = BufferOverflow.DROP_OLDEST)
    val events: SharedFlow<Unit> = _events

    fun notifyUnauthorized() {
        _events.tryEmit(Unit)
    }
}
