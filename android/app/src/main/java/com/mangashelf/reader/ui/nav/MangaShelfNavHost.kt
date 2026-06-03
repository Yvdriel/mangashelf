package com.mangashelf.reader.ui.nav

import androidx.compose.animation.EnterTransition
import androidx.compose.animation.ExitTransition
import androidx.compose.runtime.Composable
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import com.mangashelf.reader.flashcards.ui.review.ReviewRoute
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
    }
}
