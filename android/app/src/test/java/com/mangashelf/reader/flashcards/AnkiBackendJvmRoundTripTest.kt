package com.mangashelf.reader.flashcards

import anki.decks.Deck
import net.ankiweb.rsdroid.Backend
import net.ankiweb.rsdroid.BackendFactory
import net.ankiweb.rsdroid.testing.RustBackendLoader
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * F.1 host-JVM tier (best-effort, NON-blocking for the verdict).
 *
 * Mirrors the instrumented round-trip but on the local JVM, using the rsdroid testing
 * artifact (RustBackendLoader unpacks the host librsdroid.{dylib,so}). On Apple Silicon
 * the bundled dylib is a universal binary that includes an arm64 slice, so it loads here.
 * If a future host lacks a matching slice this test would fail to load the library; the
 * spike treats that case as "skipped" and relies on the instrumented tier instead.
 */
class AnkiBackendJvmRoundTripTest {

    @Test
    fun jvmRoundTrip() {
        // Loads the host-native rsdroid library into this JVM process.
        RustBackendLoader.ensureSetup()

        val col = File.createTempFile("f1_jvm_spike", ".anki2").apply { delete() }
        var backend: Backend? = null
        try {
            backend = BackendFactory.getBackend()
            backend.openCollection(col.absolutePath)
            assertTrue("collection should be open", backend.isOpen())

            // Read round-trip: Default deck resolves to id 1.
            assertEquals("Default deck id must be 1", 1L, backend.getDeckIdByName("Default"))

            // Write round-trip: create a normal deck, read it back.
            val deck = Deck.newBuilder()
                .setName("F1-Jvm-Deck")
                .setNormal(Deck.Normal.getDefaultInstance())
                .build()
            val id = backend.addDeck(deck).id
            assertTrue("addDeck must return a valid id", id > 0L)
            assertTrue(
                "created deck must be listed",
                backend.getDeckNames(true, false).any { it.name == "F1-Jvm-Deck" }
            )

            backend.closeCollection(false)

            // Reopen the same file on a fresh backend handle; the write must persist.
            backend.close()
            backend = BackendFactory.getBackend()
            backend.openCollection(col.absolutePath)
            assertTrue("reopen should succeed", backend.isOpen())
            assertTrue(
                "persisted deck must survive reopen",
                backend.getDeckNames(true, false).any { it.name == "F1-Jvm-Deck" }
            )
        } finally {
            backend?.close()
            col.delete()
            File(col.absolutePath.removeSuffix(".anki2") + ".media").deleteRecursively()
        }
    }
}
