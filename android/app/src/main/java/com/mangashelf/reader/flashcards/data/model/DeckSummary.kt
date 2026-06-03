package com.mangashelf.reader.flashcards.data.model

/** A deck plus its due breakdown, derived from rslib's `deckTree`. */
data class DeckSummary(
    val id: Long,
    val name: String,
    val newCount: Int,
    val learnCount: Int,
    val reviewCount: Int,
) {
    val due: Int get() = newCount + learnCount + reviewCount
}
