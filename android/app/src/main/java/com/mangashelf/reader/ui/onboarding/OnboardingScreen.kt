package com.mangashelf.reader.ui.onboarding

import androidx.compose.runtime.Composable
import com.mangashelf.reader.ui.common.PlaceholderScreen

@Composable
fun OnboardingScreen(onContinue: () -> Unit) {
    PlaceholderScreen(
        title = "Onboarding",
        actions = listOf("Continue to Library" to onContinue),
    )
}
