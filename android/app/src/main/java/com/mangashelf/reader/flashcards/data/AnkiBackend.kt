package com.mangashelf.reader.flashcards.data

import anki.decks.Deck
import anki.decks.DeckNameId
import net.ankiweb.rsdroid.Backend
import net.ankiweb.rsdroid.BackendFactory
import java.io.Closeable

/**
 * Thin Kotlin wrapper over the Anki Rust backend (rsdroid).
 *
 * F.1 spike scope: prove the prebuilt AAR resolves, loads its arm64 `librsdroid.so`,
 * opens an Anki collection, and survives a proto round-trip. This is deliberately small;
 * the full flashcards data layer is built later in the Flashcards pillar.
 *
 * Lifecycle:
 *  - [open] acquires a native [Backend] handle (via [BackendFactory.getBackend]) and opens
 *    the collection at the given path, creating the .anki2 file if it does not exist.
 *  - [close] closes the collection and releases the native backend; it is reopen-safe, so
 *    calling [open] again on the same path after a [close] works.
 */
class AnkiBackend : Closeable {

    private var backend: Backend? = null

    companion object {
        @Volatile private var nativeLoaded = false

        /**
         * The production rsdroid AAR does NOT auto-load its native library (no static
         * `System.loadLibrary` anywhere in the AAR — only the *testing* jar ships a loader).
         * The consumer must load `librsdroid.so` itself before constructing a [Backend],
         * otherwise the first JNI call (NativeMethods.openBackend) throws
         * UnsatisfiedLinkError. We do it once, lazily, here.
         */
        @Synchronized
        private fun ensureNativeLoaded() {
            if (nativeLoaded) return
            System.loadLibrary("rsdroid")
            nativeLoaded = true
        }
    }

    val isOpen: Boolean
        get() = backend?.isOpen() == true

    /**
     * Opens (or creates) the collection at [path]. Idempotent only after a [close];
     * calling [open] twice without an intervening [close] throws.
     */
    fun open(path: String) {
        check(backend == null) { "AnkiBackend already open; call close() first" }
        ensureNativeLoaded()
        val b = BackendFactory.getBackend()
        b.openCollection(path)
        backend = b
    }

    /**
     * Opens (or creates) the collection with an explicit media folder + media DB. The flashcards
     * data layer needs this form (not the single-arg [open]): media is required for mining-note
     * images (F.8 `addMediaFile`), which the single-arg open leaves unconfigured. Creating the
     * media folder up front is harmless if empty.
     */
    fun open(collectionPath: String, mediaDir: String, mediaDbPath: String) {
        check(backend == null) { "AnkiBackend already open; call close() first" }
        ensureNativeLoaded()
        val b = BackendFactory.getBackend()
        b.openCollection(collectionPath, mediaDir, mediaDbPath)
        backend = b
    }

    /**
     * The open native [Backend], for the flashcards data layer (same module). Throws if not open.
     * Exposed so [CollectionRepository] can issue the full set of typed rslib calls without this
     * thin wrapper having to passthrough every RPC.
     */
    internal fun requireBackend(): Backend = requireNotNull(backend) { "AnkiBackend not open" }

    /**
     * Replaces the open collection with the contents of [backupPath] (a `.colpkg`). rslib's
     * collection-package import is a whole-collection replace that needs the collection closed,
     * so we close it, import (writing to [collectionPath] + media), then reopen on the same native
     * handle. Used by F.7. (Export reads the live collection and needs no close.)
     */
    fun importCollectionPackage(
        collectionPath: String,
        backupPath: String,
        mediaDir: String,
        mediaDbPath: String,
    ) {
        val b = requireNotNull(backend) { "AnkiBackend not open" }
        if (b.isOpen()) b.closeCollection(false)
        b.importCollectionPackage(collectionPath, backupPath, mediaDir, mediaDbPath)
        b.openCollection(collectionPath, mediaDir, mediaDbPath)
    }

    /**
     * Proto round-trip: returns the deck names in the open collection. NOTE: on Anki 25.02
     * this is EMPTY for a brand-new collection (the Default deck, id 1, is not surfaced by
     * getDeckNames until a deck is actually created). Use [defaultDeckId] to prove the
     * round-trip on a fresh collection; this lists user-created decks once they exist.
     */
    fun deckNames(): List<DeckNameId> {
        val b = requireNotNull(backend) { "AnkiBackend not open" }
        return b.getDeckNames(/* includeFiltered = */ true, /* skipEmptyDefault = */ false)
    }

    /**
     * Proto round-trip that is guaranteed non-empty on any valid collection: resolves the
     * id of the always-present Default deck (id 1). rslib materializes the Default deck on
     * first lookup if [getDeckNames] reported it as empty/hidden, so this both proves the
     * request/response round-trip AND forces the Default deck to exist.
     */
    fun defaultDeckId(): Long {
        val b = requireNotNull(backend) { "AnkiBackend not open" }
        return b.getDeckIdByName("Default")
    }

    /**
     * Full write+read proto round-trip: builds a [Deck] proto, sends it via addDeck, and
     * returns the new deck id. The created deck is then visible in [deckNames]. This proves
     * the request carries a non-trivial proto payload and the backend mutates + persists it.
     */
    fun createDeck(name: String): Long {
        val b = requireNotNull(backend) { "AnkiBackend not open" }
        // The Deck proto has a required `kind` oneof (normal | filtered); addDeck rejects a
        // deck with no kind set ("missing kind"). A plain study deck is `normal`.
        val deck = Deck.newBuilder()
            .setName(name)
            .setNormal(Deck.Normal.getDefaultInstance())
            .build()
        return b.addDeck(deck).id
    }

    /**
     * Forces the collection (re)open on the existing native handle. Tolerant of the collection
     * being already open OR already closed — rslib's `exportCollectionPackage` closes the
     * collection as a snapshot side effect, leaving it closed, so callers reopen after export.
     */
    fun reopenCollection(collectionPath: String, mediaDir: String, mediaDbPath: String) {
        val b = requireNotNull(backend) { "AnkiBackend not open" }
        runCatching { b.closeCollection(false) }
        b.openCollection(collectionPath, mediaDir, mediaDbPath)
    }

    /**
     * Closes the collection and releases the native backend. Safe to call when not open. The
     * collection may already be closed (e.g. right after an export), so a failing close is
     * swallowed; the native handle is always released.
     */
    override fun close() {
        val b = backend ?: return
        try {
            // downgrade=false: do not rewrite the schema to a legacy version on close.
            runCatching { b.closeCollection(false) }
        } finally {
            b.close()
            backend = null
        }
    }
}
