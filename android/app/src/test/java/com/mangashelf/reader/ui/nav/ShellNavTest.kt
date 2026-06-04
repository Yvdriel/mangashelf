package com.mangashelf.reader.ui.nav

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * D3.3: the 3-section shell's pure route→section mapping and bottom-bar visibility. Reader is the
 * default section (library / manga detail / downloads / settings live under it); Dictionary and
 * Flashcards own their route prefixes. The bar is hidden on onboarding and inside the reader
 * (immersive full-screen reading).
 */
class ShellNavTest {

    @Test
    fun dictRoutes_mapToDictionarySection() {
        assertEquals(ShellSection.DICTIONARY, ShellNav.sectionForRoute(Routes.DICT_SEARCH))
        assertEquals(ShellSection.DICTIONARY, ShellNav.sectionForRoute("dict/entry/{sequence}"))
    }

    @Test
    fun flashcardsRoutes_mapToFlashcardsSection() {
        assertEquals(ShellSection.FLASHCARDS, ShellNav.sectionForRoute(Routes.FLASHCARDS_HOME))
        assertEquals(ShellSection.FLASHCARDS, ShellNav.sectionForRoute(Routes.FLASHCARDS_REVIEW))
    }

    @Test
    fun readerPillarRoutes_mapToReaderSection() {
        assertEquals(ShellSection.READER, ShellNav.sectionForRoute(Routes.LIBRARY))
        assertEquals(ShellSection.READER, ShellNav.sectionForRoute(Routes.MANGA_DETAIL))
        assertEquals(ShellSection.READER, ShellNav.sectionForRoute(Routes.READER))
        assertEquals(ShellSection.READER, ShellNav.sectionForRoute(Routes.DOWNLOADS))
        assertEquals(ShellSection.READER, ShellNav.sectionForRoute(Routes.SETTINGS))
    }

    @Test
    fun onboarding_hasNoSection() {
        assertNull(ShellNav.sectionForRoute(Routes.ONBOARDING))
        assertNull(ShellNav.sectionForRoute(null))
    }

    @Test
    fun bottomBar_hiddenOnOnboardingAndReader_shownElsewhere() {
        assertFalse(ShellNav.showBottomBar(Routes.ONBOARDING))
        assertFalse(ShellNav.showBottomBar(Routes.READER)) // immersive reading
        assertFalse(ShellNav.showBottomBar(null))
        assertTrue(ShellNav.showBottomBar(Routes.LIBRARY))
        assertTrue(ShellNav.showBottomBar(Routes.DICT_SEARCH))
        assertTrue(ShellNav.showBottomBar(Routes.FLASHCARDS_HOME))
    }
}
