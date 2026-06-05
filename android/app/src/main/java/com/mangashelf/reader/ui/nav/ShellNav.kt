package com.mangashelf.reader.ui.nav

/**
 * The three top-level sections of the app shell (D3.3). [root] is each section's start route; the
 * bottom nav switches between them. [glyph] is a compact CJK label used as the e-ink-friendly icon.
 */
enum class ShellSection(val label: String, val glyph: String, val root: String) {
    READER("Reader", "本", Routes.LIBRARY),
    DICTIONARY("Dictionary", "辞", Routes.DICT_SEARCH),
    FLASHCARDS("Flashcards", "札", Routes.FLASHCARDS_HOME),
}

/**
 * Pure route→shell mapping + bottom-bar visibility (JVM-testable, no Compose/Android). Reader is the
 * default section (library / manga detail / downloads / settings hang off it); Dictionary and
 * Flashcards own their route prefixes. The bar hides on onboarding and inside the reader (immersive).
 */
object ShellNav {

    fun sectionForRoute(route: String?): ShellSection? = when {
        route == null || route == Routes.ONBOARDING -> null
        route.startsWith("dict") -> ShellSection.DICTIONARY
        route.startsWith("flashcards") -> ShellSection.FLASHCARDS
        else -> ShellSection.READER
    }

    fun showBottomBar(route: String?): Boolean =
        route != null && route != Routes.ONBOARDING && !route.startsWith("reader/")
}
