package com.mangashelf.reader.flashcards.ui.settings

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Divider
import androidx.compose.material3.Slider
import androidx.compose.material3.Switch
import android.widget.Toast
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.collectAsState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.mangashelf.reader.flashcards.data.model.SchedulerSettings
import com.mudita.mmd.components.buttons.ButtonMMD
import com.mudita.mmd.components.text.TextMMD
import kotlin.math.roundToInt

/** Route wrapper: binds the Hilt [SchedulerSettingsViewModel] to the stateless screen (F.5). */
@Composable
fun SchedulerSettingsRoute(
    onBack: () -> Unit,
    viewModel: SchedulerSettingsViewModel = hiltViewModel(),
) {
    val settings by viewModel.settings.collectAsState()
    val context = LocalContext.current
    LaunchedEffect(viewModel) {
        viewModel.savedEvents.collect {
            Toast.makeText(context, "Saved", Toast.LENGTH_SHORT).show()
        }
    }
    SchedulerSettingsScreen(
        settings = settings,
        onRollover = viewModel::setRollover,
        onNewPerDay = viewModel::setNewPerDay,
        onReviewsPerDay = viewModel::setReviewsPerDay,
        onFsrs = viewModel::setFsrsEnabled,
        onRetention = viewModel::setDesiredRetention,
        onSave = viewModel::save,
        onBack = onBack,
    )
}

/**
 * F.5 scheduler settings. Edits the single global preset: day-rollover hour, new/review daily
 * caps, FSRS toggle, and desired retention. Stateless so it can be Compose-tested without Hilt.
 * Inputs use Material3 [Slider]/[Switch] (MMD has no equivalents); labels use [TextMMD] and the
 * Save action uses [ButtonMMD].
 */
@Composable
fun SchedulerSettingsScreen(
    settings: SchedulerSettings,
    onRollover: (Int) -> Unit,
    onNewPerDay: (Int) -> Unit,
    onReviewsPerDay: (Int) -> Unit,
    onFsrs: (Boolean) -> Unit,
    onRetention: (Float) -> Unit,
    onSave: () -> Unit,
    onBack: () -> Unit,
) {
    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
    ) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Start) {
            ButtonMMD(onClick = onBack) { TextMMD("Back") }
        }
        Spacer(Modifier.height(12.dp))

        IntSliderRow(
            label = "Next day starts at: ${settings.rolloverHour}:00",
            value = settings.rolloverHour,
            valueRange = 0f..23f,
            steps = 22, // 24 discrete positions (0..23)
            onValueChange = onRollover,
        )

        SettingsDivider()

        IntSliderRow(
            label = "Max new/day: ${settings.newPerDay}",
            value = settings.newPerDay,
            valueRange = 0f..50f,
            steps = 49,
            onValueChange = onNewPerDay,
        )

        SettingsDivider()

        IntSliderRow(
            label = "Max reviews/day: ${settings.reviewsPerDay}",
            value = settings.reviewsPerDay,
            valueRange = 0f..500f,
            steps = 49, // every 10 reviews
            onValueChange = onReviewsPerDay,
        )

        SettingsDivider()

        Row(
            Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            TextMMD("FSRS enabled")
            Switch(checked = settings.fsrsEnabled, onCheckedChange = onFsrs)
        }

        SettingsDivider()

        val retentionPct = (settings.desiredRetention * 100f).roundToInt()
        TextMMD("Desired retention: $retentionPct%")
        Slider(
            value = settings.desiredRetention,
            onValueChange = onRetention,
            valueRange = 0.7f..0.99f,
            modifier = Modifier.fillMaxWidth(),
        )

        Spacer(Modifier.height(24.dp))
        ButtonMMD(onClick = onSave, modifier = Modifier.fillMaxWidth()) {
            TextMMD("Save")
        }
    }
}

@Composable
private fun IntSliderRow(
    label: String,
    value: Int,
    valueRange: ClosedFloatingPointRange<Float>,
    steps: Int,
    onValueChange: (Int) -> Unit,
) {
    TextMMD(label)
    Slider(
        value = value.toFloat(),
        onValueChange = { onValueChange(it.roundToInt()) },
        valueRange = valueRange,
        steps = steps,
        modifier = Modifier.fillMaxWidth(),
    )
}

@Composable
private fun SettingsDivider() {
    Spacer(Modifier.height(12.dp))
    Divider()
    Spacer(Modifier.height(12.dp))
}
