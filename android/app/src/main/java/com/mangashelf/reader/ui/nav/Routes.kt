package com.mangashelf.reader.ui.nav

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
}
