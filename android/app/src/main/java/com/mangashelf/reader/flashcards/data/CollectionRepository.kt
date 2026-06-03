package com.mangashelf.reader.flashcards.data

import androidx.annotation.VisibleForTesting
import anki.deck_config.DeckConfigsForUpdate
import anki.deck_config.UpdateDeckConfigsMode
import anki.decks.Deck
import anki.notes.Note
import anki.scheduler.CardAnswer
import com.google.protobuf.ByteString
import com.mangashelf.reader.di.CollectionDir
import com.mangashelf.reader.flashcards.data.model.AnswerOption
import com.mangashelf.reader.flashcards.data.model.DeckSummary
import com.mangashelf.reader.flashcards.data.model.NoteFields
import com.mangashelf.reader.flashcards.data.model.Rating
import com.mangashelf.reader.flashcards.data.model.ReviewCard
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import net.ankiweb.rsdroid.Backend
import java.io.File
import javax.inject.Inject
import javax.inject.Singleton

/**
 * The flashcards collection façade over the rsdroid [Backend]. Owns the collection lifecycle,
 * serialises all backend access (the Rust backend is synchronous and not safe for concurrent
 * calls), and exposes the high-level flashcards operations.
 *
 * F.2: [bootstrap] (deck + "MangaShelf Mining" notetype + FSRS @ retention 0.90) and the decks /
 * due-count [decks] flow. F.8: [addMiningNote] — the card-creation hook consumed by the OCR popup
 * (O.3) and the dictionary (D3.2).
 */
@Singleton
class CollectionRepository @Inject constructor(
    private val ankiBackend: AnkiBackend,
    @CollectionDir private val collectionDir: File,
) {
    companion object {
        const val MINING_DECK = "Mining"
        const val DEFAULT_RETENTION = 0.90f

        /** The Default deck (and its default config preset) are always id 1 in a fresh collection. */
        private const val DEFAULT_DECK_ID = 1L
        private const val COLLECTION_FILE = "collection.anki2"
        private const val MEDIA_DIR = "collection.media"
        private const val MEDIA_DB = "collection.media.db2"
    }

    private val mutex = Mutex()

    private val _decks = MutableStateFlow<List<DeckSummary>>(emptyList())
    fun decks(): StateFlow<List<DeckSummary>> = _decks.asStateFlow()

    /**
     * Idempotent first-run setup: open the collection, ensure the "Mining" deck + the
     * "MangaShelf Mining" notetype exist, and enable FSRS globally at desired-retention 0.90.
     * Safe to call on every launch. Returns the Mining deck id.
     */
    suspend fun bootstrap(): Long {
        val deckId = withBackend { b ->
            val id = ensureDeck(b, MINING_DECK)
            MiningNotetype.ensure(b)
            enableFsrs(b, DEFAULT_RETENTION)
            id
        }
        refreshDecks()
        return deckId
    }

    suspend fun miningDeckId(): Long = withBackend { b -> ensureDeck(b, MINING_DECK) }

    /** Recomputes the deck/due snapshot from rslib's `deckTree` and publishes it on [decks]. */
    suspend fun refreshDecks() {
        val nowSec = System.currentTimeMillis() / 1000L
        _decks.value = withBackend { b ->
            b.deckTree(nowSec).childrenList.map {
                DeckSummary(
                    id = it.deckId,
                    name = it.name,
                    newCount = it.newCount,
                    learnCount = it.learnCount,
                    reviewCount = it.reviewCount,
                )
            }
        }
    }

    /**
     * F.8 mining hook. Stores [imageBytes] as a media file (if present), references it in the
     * Image field as `<img src="…">`, and adds a note into [deckId]. Field order matches the
     * notetype: Sentence, Image, Definition, Source. [tags] must already be expanded (see
     * [TagTemplate]). Returns the new note id.
     */
    suspend fun addMiningNote(
        deckId: Long,
        sentence: String,
        imageBytes: ByteArray?,
        imageFilename: String,
        definitionHtml: String?,
        source: String?,
        tags: List<String>,
    ): Long = withBackend { b ->
        val notetypeId = MiningNotetype.ensure(b)
        val imageField = imageBytes?.let {
            val storedName = b.addMediaFile(imageFilename, ByteString.copyFrom(it))
            "<img src=\"$storedName\">"
        }.orEmpty()
        val note = Note.newBuilder()
            .setNotetypeId(notetypeId)
            .addFields(sentence.replace("\n", "<br>")) // Sentence
            .addFields(imageField)                      // Image
            .addFields(definitionHtml.orEmpty())        // Definition
            .addFields(source.orEmpty())                // Source
            .addAllTags(tags)
            .build()
        b.addNote(note, deckId).noteId
    }

    // --- F.3 review --------------------------------------------------------------

    /**
     * The next due card in [deckId] (or null if the queue is empty). Resolves the note's fields by
     * the Mining field order and labels the four buttons with the backend's next-interval strings
     * (`describeNextStates`, 1:1 with desktop Anki).
     */
    suspend fun nextCard(deckId: Long): ReviewCard? = withBackend { b ->
        b.setCurrentDeck(deckId)
        val queued = b.getQueuedCards(/* fetchLimit = */ 1, /* intradayLearningOnly = */ false)
        if (queued.cardsCount == 0) return@withBackend null
        val qc = queued.getCards(0)
        val card = qc.card
        val fields = b.getNote(card.noteId).fieldsList
        val labels = b.describeNextStates(qc.states)
        ReviewCard(
            cardId = card.id,
            noteId = card.noteId,
            fields = NoteFields(
                sentence = fields.getOrElse(0) { "" },
                imageHtml = fields.getOrElse(1) { "" },
                definitionHtml = fields.getOrElse(2) { "" },
                source = fields.getOrElse(3) { "" },
            ),
            options = listOf(
                AnswerOption(Rating.AGAIN, labels.getOrElse(0) { "" }),
                AnswerOption(Rating.HARD, labels.getOrElse(1) { "" }),
                AnswerOption(Rating.GOOD, labels.getOrElse(2) { "" }),
                AnswerOption(Rating.EASY, labels.getOrElse(3) { "" }),
            ),
        )
    }

    /**
     * Answers [cardId] with [rating] (FSRS). Reads the card's current scheduling states fresh and
     * picks the matching next state, so callers never thread proto state through the UI.
     */
    suspend fun answer(cardId: Long, rating: Rating, tookMs: Int = 0): Unit = withBackend { b ->
        val states = b.getSchedulingStates(cardId)
        val newState = when (rating) {
            Rating.AGAIN -> states.again
            Rating.HARD -> states.hard
            Rating.GOOD -> states.good
            Rating.EASY -> states.easy
        }
        b.answerCard(
            CardAnswer.newBuilder()
                .setCardId(cardId)
                .setCurrentState(states.current)
                .setNewState(newState)
                .setRating(rating.toProto())
                .setAnsweredAtMillis(System.currentTimeMillis())
                .setMillisecondsTaken(tookMs)
                .build(),
        )
        Unit
    }

    /** Resolves an Image-field `<img src>` filename to its file in the collection media folder. */
    fun imageFile(filename: String): File = File(File(collectionDir, MEDIA_DIR), filename)

    fun close() = ankiBackend.close()

    // --- internals -------------------------------------------------------------

    private fun Rating.toProto(): CardAnswer.Rating = when (this) {
        Rating.AGAIN -> CardAnswer.Rating.AGAIN
        Rating.HARD -> CardAnswer.Rating.HARD
        Rating.GOOD -> CardAnswer.Rating.GOOD
        Rating.EASY -> CardAnswer.Rating.EASY
    }

    private fun ensureDeck(b: Backend, name: String): Long {
        b.getDeckNames(/* includeFiltered = */ true, /* skipEmptyDefault = */ false)
            .firstOrNull { it.name == name }
            ?.let { return it.id }
        val deck = Deck.newBuilder()
            .setName(name)
            .setNormal(Deck.Normal.getDefaultInstance())
            .build()
        return b.addDeck(deck).id
    }

    /**
     * Enables FSRS globally (collection-level) and sets desired-retention on every config preset.
     * The `fsrs` flag on `updateDeckConfigs` is a collection setting, so the target deck is the
     * always-present Default deck.
     */
    private fun enableFsrs(b: Backend, desiredRetention: Float) {
        b.getDeckIdByName("Default") // materialise the Default deck (id 1) before reading its config
        val forUpdate = b.getDeckConfigsForUpdate(DEFAULT_DECK_ID)
        val configs = forUpdate.allConfigList.map { configWithExtra ->
            val deckConfig = configWithExtra.config
            deckConfig.toBuilder()
                .setConfig(
                    deckConfig.config.toBuilder()
                        .setDesiredRetention(desiredRetention)
                        .build(),
                )
                .build()
        }
        // The trailing booleans are passed in proto field-number order:
        // new_cards_ignore_review_limit(7), fsrs(8), apply_all_parent_limits(9), fsrs_reschedule(10).
        b.updateDeckConfigs(
            DEFAULT_DECK_ID,
            configs,
            emptyList(),
            UpdateDeckConfigsMode.UPDATE_DECK_CONFIGS_MODE_NORMAL,
            "",
            DeckConfigsForUpdate.CurrentDeck.Limits.getDefaultInstance(),
            false, // newCardsIgnoreReviewLimit
            true,  // fsrs — enable globally
            false, // applyAllParentLimits
            false, // fsrsReschedule
        )
    }

    private suspend fun <T> withBackend(block: (Backend) -> T): T = mutex.withLock {
        withContext(Dispatchers.IO) {
            ensureOpen()
            block(ankiBackend.requireBackend())
        }
    }

    private fun ensureOpen() {
        if (ankiBackend.isOpen) return
        collectionDir.mkdirs()
        val col = File(collectionDir, COLLECTION_FILE).absolutePath
        val media = File(collectionDir, MEDIA_DIR).apply { mkdirs() }.absolutePath
        val mediaDb = File(collectionDir, MEDIA_DB).absolutePath
        ankiBackend.open(col, media, mediaDb)
    }

    /** Test-only: run a block against the open backend through the same serialised path. */
    @VisibleForTesting
    internal suspend fun <T> onBackend(block: (Backend) -> T): T = withBackend(block)
}
