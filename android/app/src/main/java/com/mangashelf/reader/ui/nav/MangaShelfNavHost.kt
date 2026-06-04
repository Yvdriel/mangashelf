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
import com.mangashelf.reader.ui.library.LibraryRoute
import com.mangashelf.reader.ui.manga.MangaDetailRoute
import com.mangashelf.reader.ui.onboarding.OnboardingRoute
import com.mangashelf.reader.ui.reader.ReaderRoute
import com.mangashelf.reader.ui.settings.SettingsScreen

/**
 * App nav graph. Transitions disabled (e-ink: no animation, instant repaint). [startDestination]
 * is Library when the device is already onboarded (token persisted), else Onboarding.
 */
@Composable
fun MangaShelfNavHost(
    navController: NavHostController,
    startDestination: String = Routes.ONBOARDING,
) {
    NavHost(
        navController = navController,
        startDestination = startDestination,
        enterTransition = { EnterTransition.None },
        exitTransition = { ExitTransition.None },
        popEnterTransition = { EnterTransition.None },
        popExitTransition = { ExitTransition.None },
    ) {
        composable(Routes.ONBOARDING) {
            OnboardingRoute(onConnected = {
                navController.navigate(Routes.LIBRARY) {
                    popUpTo(Routes.ONBOARDING) { inclusive = true }
                }
            })
        }
        composable(Routes.LIBRARY) {
            LibraryRoute(
                onOpenManga = { mangaId -> navController.navigate(Routes.mangaDetail(mangaId)) },
                onDownloads = { navController.navigate(Routes.DOWNLOADS) },
                onSettings = { navController.navigate(Routes.SETTINGS) },
                onFlashcards = { navController.navigate(Routes.FLASHCARDS_REVIEW) },
                onScheduler = { navController.navigate(Routes.FLASHCARDS_SETTINGS) },
                onHeatmap = { navController.navigate(Routes.FLASHCARDS_HEATMAP) },
                onImportExport = { navController.navigate(Routes.FLASHCARDS_IMPORT_EXPORT) },
            )
        }
        composable(
            Routes.MANGA_DETAIL,
            arguments = listOf(navArgument(Routes.MANGA_ID_ARG) { type = NavType.IntType }),
        ) { entry ->
            val mangaId = entry.arguments?.getInt(Routes.MANGA_ID_ARG) ?: 0
            MangaDetailRoute(
                onRead = { volumeNumber -> navController.navigate(Routes.reader(mangaId, volumeNumber)) },
                onBack = { navController.popBackStack() },
            )
        }
        composable(
            Routes.READER,
            arguments = listOf(
                navArgument(Routes.READER_ARG_MANGA_ID) { type = NavType.IntType },
                navArgument(Routes.READER_ARG_VOLUME) { type = NavType.IntType },
            ),
        ) {
            ReaderRoute(onBack = { navController.popBackStack() })
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
