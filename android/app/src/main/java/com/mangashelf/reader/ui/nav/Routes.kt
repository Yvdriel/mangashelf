package com.mangashelf.reader.ui.nav

import android.net.Uri

/** Reader-pillar nav routes. The 3-section app shell (Reader/Dict/Flashcards) is CH.9 / D3.3. */
object Routes {
    const val ONBOARDING = "onboarding"
    const val LIBRARY = "library"
    const val MANGA_ID_ARG = "mangaId"
    const val MANGA_DETAIL = "manga_detail/{$MANGA_ID_ARG}"
    const val READER = "reader"
    const val DOWNLOADS = "downloads"
    const val SETTINGS = "settings"

    /** Builds the manga-detail route for a concrete manga id. */
    fun mangaDetail(mangaId: Int) = "manga_detail/$mangaId"

    /** Flashcards (F.3–F.7). Temporary top-level entries until the 3-section shell (D3.3). */
    const val FLASHCARDS_REVIEW = "flashcards/review"
    const val FLASHCARDS_SETTINGS = "flashcards/settings"
    const val FLASHCARDS_HEATMAP = "flashcards/heatmap"
    const val FLASHCARDS_IMPORT_EXPORT = "flashcards/import_export"

    /** Dictionary pillar (D2.2–D2.6). Temporary top-level entries until the 3-section shell (D3.3). */
    const val DICT_SEARCH = "dict/search"
    const val DICT_ENTRY = "dict/entry/{sequence}"
    const val DICT_KANJI = "dict/kanji/{char}"
    const val DICT_KANA = "dict/kana"
    const val DICT_RADICAL = "dict/radical"

    const val DICT_ARG_SEQUENCE = "sequence"
    const val DICT_ARG_CHAR = "char"

    fun dictEntry(sequence: Int) = "dict/entry/$sequence"
    fun dictKanji(character: String) = "dict/kanji/${Uri.encode(character)}"
}
