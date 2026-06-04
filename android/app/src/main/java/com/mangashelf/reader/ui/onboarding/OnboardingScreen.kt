package com.mangashelf.reader.ui.onboarding

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.mudita.mmd.components.buttons.ButtonMMD
import com.mudita.mmd.components.text.TextMMD

/** Route wrapper: binds the Hilt [OnboardingViewModel] and navigates on the connected event (2.3). */
@Composable
fun OnboardingRoute(
    onConnected: () -> Unit,
    viewModel: OnboardingViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsState()
    LaunchedEffect(viewModel) {
        viewModel.connected.collect { onConnected() }
    }
    OnboardingScreen(
        state = state,
        onServerUrl = viewModel::setServerUrl,
        onToken = viewModel::setToken,
        onConnect = viewModel::connect,
    )
}

/**
 * Server URL + access-token entry. "Connect" calls whoami; a bad URL/token shows the MMD error row
 * and persists nothing. Stateless so it can be Compose-tested without Hilt. Text fields are
 * Material3 (MMD has no input field); labels/button/error use MMD.
 */
@Composable
fun OnboardingScreen(
    state: OnboardingViewModel.UiState,
    onServerUrl: (String) -> Unit,
    onToken: (String) -> Unit,
    onConnect: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        verticalArrangement = Arrangement.Center,
    ) {
        TextMMD("Connect to your server")
        Spacer(Modifier.height(24.dp))

        OutlinedTextField(
            value = state.serverUrl,
            onValueChange = onServerUrl,
            label = { Text("Server URL") },
            placeholder = { Text("http://10.0.2.2:3000") },
            singleLine = true,
            enabled = !state.connecting,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri),
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(16.dp))
        OutlinedTextField(
            value = state.token,
            onValueChange = onToken,
            label = { Text("Access token") },
            placeholder = { Text("mst_…") },
            singleLine = true,
            enabled = !state.connecting,
            visualTransformation = PasswordVisualTransformation(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
            modifier = Modifier.fillMaxWidth(),
        )

        state.error?.let { error ->
            Spacer(Modifier.height(16.dp))
            TextMMD(error)
        }

        Spacer(Modifier.height(24.dp))
        ButtonMMD(onClick = onConnect, modifier = Modifier.fillMaxWidth()) {
            TextMMD(if (state.connecting) "Connecting…" else "Connect")
        }
    }
}
