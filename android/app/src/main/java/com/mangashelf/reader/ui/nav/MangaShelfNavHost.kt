package com.mangashelf.reader.ui.nav

import androidx.compose.animation.EnterTransition
import androidx.compose.animation.ExitTransition
import androidx.compose.runtime.Composable
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.navArgument
import com.mangashelf.reader.dict.ui.entry.EntryRoute
import com.mangashelf.reader.dict.ui.kana.KanaTableRoute
import com.mangashelf.reader.dict.ui.kanji.KanjiRoute
import com.mangashelf.reader.dict.ui.radical.RadicalRoute
import com.mangashelf.reader.dict.ui.search.SearchRoute
import com.mangashelf.reader.flashcards.ui.importexport.ImportExportRoute
import com.mangashelf.reader.flashcards.ui.review.ReviewRoute
import com.mangashelf.reader.flashcards.ui.settings.SchedulerSettingsRoute
import com.mangashelf.reader.flashcards.ui.stats.HeatmapRoute
import com.mangashelf.reader.ui.downloads.DownloadsScreen
import com.mangashelf.reader.ui.library.LibraryScreen
import com.mangashelf.reader.ui.manga.MangaDetailScreen
import com.mangashelf.reader.ui.onboarding.OnboardingScreen
import com.mangashelf.reader.ui.reader.ReaderScreen
import com.mangashelf.reader.ui.settings.SettingsScreen

/**
 * App nav graph. Transitions disabled (e-ink: no animation, instant repaint).
 * Destinations are 2.1 placeholders wired to prove navigation; real screens land later.
 */
@Composable
fun MangaShelfNavHost(navController: NavHostController) {
    NavHost(
        navController = navController,
        startDestination = Routes.ONBOARDING,
        enterTransition = { EnterTransition.None },
        exitTransition = { ExitTransition.None },
        popEnterTransition = { EnterTransition.None },
        popExitTransition = { ExitTransition.None },
    ) {
        composable(Routes.ONBOARDING) {
            OnboardingScreen(onContinue = {
                navController.navigate(Routes.LIBRARY) {
                    popUpTo(Routes.ONBOARDING) { inclusive = true }
                }
            })
        }
        composable(Routes.LIBRARY) {
            LibraryScreen(
                onOpenManga = { navController.navigate(Routes.MANGA_DETAIL) },
                onDownloads = { navController.navigate(Routes.DOWNLOADS) },
                onSettings = { navController.navigate(Routes.SETTINGS) },
                onFlashcards = { navController.navigate(Routes.FLASHCARDS_REVIEW) },
                onScheduler = { navController.navigate(Routes.FLASHCARDS_SETTINGS) },
                onHeatmap = { navController.navigate(Routes.FLASHCARDS_HEATMAP) },
                onImportExport = { navController.navigate(Routes.FLASHCARDS_IMPORT_EXPORT) },
            )
        }
        composable(Routes.MANGA_DETAIL) {
            MangaDetailScreen(
                onRead = { navController.navigate(Routes.READER) },
                onBack = { navController.popBackStack() },
            )
        }
        composable(Routes.READER) {
            ReaderScreen(onBack = { navController.popBackStack() })
        }
        composable(Routes.DOWNLOADS) {
            DownloadsScreen(onBack = { navController.popBackStack() })
        }
        composable(Routes.SETTINGS) {
            SettingsScreen(onBack = { navController.popBackStack() })
        }
        composable(Routes.FLASHCARDS_REVIEW) {
            ReviewRoute(onBack = { navController.popBackStack() })
        }
        composable(Routes.FLASHCARDS_SETTINGS) {
            SchedulerSettingsRoute(onBack = { navController.popBackStack() })
        }
        composable(Routes.FLASHCARDS_HEATMAP) {
            HeatmapRoute(onBack = { navController.popBackStack() })
        }
        composable(Routes.FLASHCARDS_IMPORT_EXPORT) {
            ImportExportRoute(onBack = { navController.popBackStack() })
        }

        // Dictionary pillar (D2.2–D2.6). Reachable from the 3-section shell in D3.3 (CH.9).
        composable(Routes.DICT_SEARCH) {
            SearchRoute(
                onOpenEntry = { navController.navigate(Routes.dictEntry(it)) },
                onOpenKanji = { navController.navigate(Routes.dictKanji(it)) },
                onKana = { navController.navigate(Routes.DICT_KANA) },
                onRadical = { navController.navigate(Routes.DICT_RADICAL) },
                onBack = { navController.popBackStack() },
            )
        }
        composable(
            Routes.DICT_ENTRY,
            arguments = listOf(navArgument(Routes.DICT_ARG_SEQUENCE) { type = NavType.IntType }),
        ) {
            EntryRoute(
                onOpenKanji = { navController.navigate(Routes.dictKanji(it)) },
                onBack = { navController.popBackStack() },
            )
        }
        composable(
            Routes.DICT_KANJI,
            arguments = listOf(navArgument(Routes.DICT_ARG_CHAR) { type = NavType.StringType }),
        ) {
            KanjiRoute(
                onOpenEntry = { navController.navigate(Routes.dictEntry(it)) },
                onBack = { navController.popBackStack() },
            )
        }
        composable(Routes.DICT_KANA) {
            KanaTableRoute(onBack = { navController.popBackStack() })
        }
        composable(Routes.DICT_RADICAL) {
            RadicalRoute(
                onOpenKanji = { navController.navigate(Routes.dictKanji(it)) },
                onBack = { navController.popBackStack() },
            )
        }
    }
}
