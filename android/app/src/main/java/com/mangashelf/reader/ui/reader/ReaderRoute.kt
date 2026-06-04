package com.mangashelf.reader.ui.reader

import androidx.activity.compose.BackHandler
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.hilt.navigation.compose.hiltViewModel

/** Binds [ReaderViewModel] to the stateless [ReaderScreen] (CH.7 4.2). */
@Composable
fun ReaderRoute(
    onBack: () -> Unit,
    viewModel: ReaderViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsState()

    // System back leaves the reader (4.3 will intercept it first to exit zoom).
    BackHandler(onBack = onBack)

    DisposableEffect(viewModel) {
        onDispose { /* readerActive is cleared in the ViewModel's onCleared */ }
    }

    ReaderScreen(
        state = state,
        onPrev = viewModel::prev,
        onNext = viewModel::next,
        onToggleBar = viewModel::toggleBar,
        onEnterZoom = viewModel::enterZoom,
        onOcrBlockDoubleTap = viewModel::onOcrBlockDoubleTap,
        onBack = onBack,
    )
}
