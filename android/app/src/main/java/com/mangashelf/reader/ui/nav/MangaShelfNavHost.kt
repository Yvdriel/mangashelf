package com.mangashelf.reader.ui.nav

import androidx.compose.animation.EnterTransition
import androidx.compose.animation.ExitTransition
import androidx.compose.runtime.Composable
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.navArgument
import com.mangashelf.reader.flashcards.ui.importexport.ImportExportRoute
import com.mangashelf.reader.flashcards.ui.review.ReviewRoute
import com.mangashelf.reader.flashcards.ui.settings.SchedulerSettingsRoute
import com.mangashelf.reader.flashcards.ui.stats.HeatmapRoute
import com.mangashelf.reader.ui.downloads.DownloadsScreen
import com.mangashelf.reader.ui.library.LibraryRoute
import com.mangashelf.reader.ui.manga.MangaDetailRoute
import com.mangashelf.reader.ui.onboarding.OnboardingRoute
import com.mangashelf.reader.ui.reader.ReaderScreen
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
        ) {
            MangaDetailRoute(
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
    }
}
