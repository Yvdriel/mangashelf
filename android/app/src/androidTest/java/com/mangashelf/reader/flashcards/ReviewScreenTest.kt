package com.mangashelf.reader.flashcards

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.mangashelf.reader.flashcards.data.model.AnswerOption
import com.mangashelf.reader.flashcards.data.model.NoteFields
import com.mangashelf.reader.flashcards.data.model.Rating
import com.mangashelf.reader.flashcards.data.model.ReviewCard
import com.mangashelf.reader.flashcards.ui.review.ReviewScreen
import com.mangashelf.reader.flashcards.ui.review.ReviewUiState
import com.mangashelf.reader.ui.theme.MangaShelfTheme
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File

/** F.3 UI: the stateless review screen, no Hilt/backend. */
@RunWith(AndroidJUnit4::class)
class ReviewScreenTest {

    @get:Rule
    val compose = createComposeRule()

    private val card = ReviewCard(
        cardId = 1L,
        noteId = 1L,
        fields = NoteFields(sentence = "日本語の文", imageHtml = "", definitionHtml = "<b>def</b>", source = "src"),
        options = listOf(
            AnswerOption(Rating.AGAIN, "1m"),
            AnswerOption(Rating.HARD, "6m"),
            AnswerOption(Rating.GOOD, "10m"),
            AnswerOption(Rating.EASY, "16d"),
        ),
    )

    @Test
    fun front_showsSentenceAndShowAnswer() {
        compose.setContent {
            MangaShelfTheme {
                ReviewScreen(
                    state = ReviewUiState.Reviewing(card, answerShown = false),
                    onShowAnswer = {},
                    onAnswer = {},
                    imageFileFor = { File(it) },
                    onBack = {},
                )
            }
        }
        compose.onNodeWithText("日本語の文").assertIsDisplayed()
        compose.onNodeWithText("Show Answer").assertIsDisplayed()
    }

    @Test
    fun back_showsFourButtonsLabelledWithBackendIntervals() {
        compose.setContent {
            MangaShelfTheme {
                ReviewScreen(
                    state = ReviewUiState.Reviewing(card, answerShown = true),
                    onShowAnswer = {},
                    onAnswer = {},
                    imageFileFor = { File(it) },
                    onBack = {},
                )
            }
        }
        listOf("Again", "Hard", "Good", "Easy", "1m", "6m", "10m", "16d").forEach {
            compose.onNodeWithText(it).assertExists()
        }
    }
}
