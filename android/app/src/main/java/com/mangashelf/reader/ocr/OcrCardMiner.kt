package com.mangashelf.reader.ocr

/**
 * Mines an OCR selection into a flashcard. A thin seam over F.8
 * [com.mangashelf.reader.flashcards.data.CollectionRepository.addMiningNote] (resolve the Mining
 * deck → add into the Mining notetype) so the reader ViewModel can be unit-tested with a fake miner
 * instead of opening the Anki backend. Returns the new note id.
 */
fun interface OcrCardMiner {
    suspend fun mine(
        sentence: String,
        imageBytes: ByteArray?,
        imageFilename: String,
        definitionHtml: String?,
        source: String?,
        tags: List<String>,
    ): Long
}
