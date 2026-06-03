package com.mangashelf.reader.flashcards.data.model

/** The four FSRS answer buttons, in display order. */
enum class Rating { AGAIN, HARD, GOOD, EASY }

/** A note's fields resolved by the MangaShelf Mining field order. */
data class NoteFields(
    val sentence: String,
    val imageHtml: String,
    val definitionHtml: String,
    val source: String,
)

/** One answer button: its rating + the backend-reported next-interval label (e.g. "16d"). */
data class AnswerOption(val rating: Rating, val intervalLabel: String)

/** The current review card: fields to render + the four buttons with their interval labels. */
data class ReviewCard(
    val cardId: Long,
    val noteId: Long,
    val fields: NoteFields,
    val options: List<AnswerOption>,
)
