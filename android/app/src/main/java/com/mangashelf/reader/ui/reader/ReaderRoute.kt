package com.mangashelf.reader.ui.reader

import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.hilt.navigation.compose.hiltViewModel

/** Binds [ReaderViewModel] to the stateless [ReaderScreen] (CH.7 4.2/4.3). */
@Composable
fun ReaderRoute(
    onBack: () -> Unit,
    viewModel: ReaderViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsState()
    // Back is handled inside ReaderScreen: it exits zoom first, else leaves the reader (onBack).
    ReaderScreen(
        state = state,
        onPrev = viewModel::prev,
        onNext = viewModel::next,
        onToggleBar = viewModel::toggleBar,
        onEnterZoom = viewModel::enterZoom,
        onOcrBlockSelected = viewModel::onOcrBlockSelected,
        onBack = onBack,
        onZoomSwipe = viewModel::onZoomSwipe,
        onExitZoom = viewModel::exitZoom,
        onCreateCard = viewModel::onCreateCard,
        onDismissPopup = viewModel::onDismissPopup,
    )
}
