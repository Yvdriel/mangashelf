package com.mangashelf.reader.di

import android.content.Context
import com.mangashelf.reader.data.reader.ArchivePaths
import com.mangashelf.reader.data.reader.PageSource
import com.mangashelf.reader.data.reader.PageSourceFactory
import com.mangashelf.reader.flashcards.data.CollectionRepository
import com.mangashelf.reader.ocr.MokuroParser
import com.mangashelf.reader.ocr.MokuroSourceFactory
import com.mangashelf.reader.ocr.OcrCardMiner
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

/** Reader pillar (CH.7). Resolves the local CBZ + tunes decode sampling to the device display. */
@Module
@InstallIn(SingletonComponent::class)
object ReaderModule {

    @Provides
    @Singleton
    fun providePageSourceFactory(@ApplicationContext context: Context): PageSourceFactory =
        PageSourceFactory { mangaId, volumeNumber ->
            // CH.8/5.1 streams downloads to this exact path; CH.7 acceptance `adb push`ed fixtures here.
            val cbz = ArchivePaths.cbz(context.filesDir, mangaId, volumeNumber)
            val metrics = context.resources.displayMetrics
            // ~480px usable on the 800×480 Kompakt; the shorter edge bounds a fit-to-height page.
            val targetWidth = minOf(metrics.widthPixels, metrics.heightPixels).coerceAtLeast(1)
            PageSource(cbz, targetWidth)
        }

    @Provides
    @Singleton
    fun provideMokuroSourceFactory(@ApplicationContext context: Context): MokuroSourceFactory =
        MokuroSourceFactory { mangaId, volumeNumber ->
            // CH.8/O.1 writes the `.mokuro` beside the CBZ (404 → absent; overlay simply stays off).
            val file = ArchivePaths.mokuro(context.filesDir, mangaId, volumeNumber)
            if (file.exists()) MokuroParser.parse(file.readText()) else null
        }

    /** F.8 mining seam for the OCR popup: resolves the Mining deck and adds into the Mining notetype. */
    @Provides
    @Singleton
    fun provideOcrCardMiner(collection: CollectionRepository): OcrCardMiner =
        OcrCardMiner { sentence, imageBytes, imageFilename, definitionHtml, source, tags ->
            val deckId = collection.miningDeckId()
            collection.addMiningNote(deckId, sentence, imageBytes, imageFilename, definitionHtml, source, tags)
        }
}
