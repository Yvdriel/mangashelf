package com.mangashelf.reader.flashcards.ui.review

import android.graphics.BitmapFactory
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
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
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.ColorMatrix
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.foundation.Image
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.compose.runtime.collectAsState
import com.mangashelf.reader.flashcards.data.model.AnswerOption
import com.mangashelf.reader.flashcards.data.model.Rating
import com.mangashelf.reader.flashcards.data.model.ReviewCard
import com.mangashelf.reader.flashcards.ui.render.HtmlSubsetText
import com.mangashelf.reader.ui.theme.NotoSansJp
import com.mudita.mmd.components.buttons.ButtonMMD
import com.mudita.mmd.components.text.TextMMD
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File

/** Route wrapper: binds the Hilt [ReviewViewModel] to the stateless [ReviewScreen]. */
@Composable
fun ReviewRoute(
    onBack: () -> Unit,
    viewModel: ReviewViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsState()
    val undoLabel by viewModel.undoLabel.collectAsState()
    ReviewScreen(
        state = state,
        undoLabel = undoLabel,
        onShowAnswer = viewModel::showAnswer,
        onAnswer = viewModel::answer,
        onUndo = viewModel::undo,
        imageFileFor = viewModel::imageFile,
        onBack = onBack,
    )
}

/**
 * F.3 review screen. Front (sentence + manga crop) → tap to Show Answer → back (definition +
 * source) → four FSRS buttons each labelled with the backend-reported next interval. Stateless so
 * it can be Compose-tested without Hilt.
 */
@Composable
fun ReviewScreen(
    state: ReviewUiState,
    onShowAnswer: () -> Unit,
    onAnswer: (Rating) -> Unit,
    imageFileFor: (String) -> File,
    onBack: () -> Unit,
    undoLabel: String = "",
    onUndo: () -> Unit = {},
) {
    Column(Modifier.fillMaxSize()) {
        if (undoLabel.isNotBlank()) {
            Row(
                Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp),
                horizontalArrangement = Arrangement.End,
            ) {
                ButtonMMD(onClick = onUndo) { TextMMD("Undo") }
            }
        }
        when (state) {
            ReviewUiState.Loading -> Centered { TextMMD("Loading…") }
            ReviewUiState.Empty -> Centered { TextMMD("Nothing due") }
            is ReviewUiState.Reviewing -> ReviewingContent(
                card = state.card,
                answerShown = state.answerShown,
                onShowAnswer = onShowAnswer,
                onAnswer = onAnswer,
                imageFileFor = imageFileFor,
            )
        }
    }
}

@Composable
private fun ReviewingContent(
    card: ReviewCard,
    answerShown: Boolean,
    onShowAnswer: () -> Unit,
    onAnswer: (Rating) -> Unit,
    imageFileFor: (String) -> File,
) {
    Column(Modifier.fillMaxSize().padding(16.dp)) {
        Column(
            Modifier
                .weight(1f)
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .clickable(enabled = !answerShown) { onShowAnswer() },
        ) {
            Text(
                text = card.fields.sentence.stripTags(),
                fontFamily = NotoSansJp,
                fontSize = 26.sp,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth(),
            )
            imageSrc(card.fields.imageHtml)?.let { name ->
                Spacer(Modifier.height(12.dp))
                CardImage(imageFileFor(name), Modifier.fillMaxWidth())
            }

            if (answerShown) {
                Spacer(Modifier.height(12.dp))
                Divider()
                Spacer(Modifier.height(12.dp))
                if (card.fields.definitionHtml.isNotBlank()) {
                    HtmlSubsetText(card.fields.definitionHtml, fontFamily = NotoSansJp)
                }
                if (card.fields.source.isNotBlank()) {
                    Spacer(Modifier.height(8.dp))
                    Text(card.fields.source.stripTags(), fontSize = 13.sp)
                }
            }
        }

        Spacer(Modifier.height(12.dp))
        if (!answerShown) {
            ButtonMMD(onClick = onShowAnswer, modifier = Modifier.fillMaxWidth()) {
                TextMMD("Show Answer")
            }
        } else {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                card.options.forEach { option ->
                    AnswerButton(option, Modifier.weight(1f)) { onAnswer(option.rating) }
                }
            }
        }
    }
}

@Composable
private fun AnswerButton(option: AnswerOption, modifier: Modifier, onClick: () -> Unit) {
    ButtonMMD(onClick = onClick, modifier = modifier) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            TextMMD(option.rating.displayName())
            Text(option.intervalLabel, fontSize = 12.sp, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun CardImage(file: File, modifier: Modifier = Modifier) {
    val bitmap by produceState<ImageBitmap?>(initialValue = null, file) {
        value = withContext(Dispatchers.IO) {
            if (file.exists()) BitmapFactory.decodeFile(file.path)?.asImageBitmap() else null
        }
    }
    bitmap?.let {
        Image(
            bitmap = it,
            contentDescription = null,
            modifier = modifier,
            contentScale = ContentScale.Fit,
            // e-ink: grayscale the manga crop to cut ghosting / banding.
            colorFilter = ColorFilter.colorMatrix(ColorMatrix().apply { setToSaturation(0f) }),
        )
    }
}

@Composable
private fun Centered(content: @Composable () -> Unit) {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { content() }
}

private fun Rating.displayName(): String = when (this) {
    Rating.AGAIN -> "Again"
    Rating.HARD -> "Hard"
    Rating.GOOD -> "Good"
    Rating.EASY -> "Easy"
}

private val IMG_SRC = Regex("src=\"([^\"]+)\"")
private val ANY_TAG = Regex("<[^>]*>")

private fun imageSrc(imageHtml: String): String? =
    IMG_SRC.find(imageHtml)?.groupValues?.get(1)?.takeIf { it.isNotBlank() }

/** Sentence/Source fields may carry inline markup (e.g. `<br>`); show them as plain text. */
private fun String.stripTags(): String = replace(ANY_TAG, "").trim()
