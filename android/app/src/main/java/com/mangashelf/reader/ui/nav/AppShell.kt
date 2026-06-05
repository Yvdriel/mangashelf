package com.mangashelf.reader.ui.nav

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavHostController
import androidx.navigation.compose.currentBackStackEntryAsState
import com.mangashelf.reader.ui.theme.NotoSansJp
import com.mudita.mmd.components.nav_bar.NavigationBarItemMMD
import com.mudita.mmd.components.nav_bar.NavigationBarMMD
import com.mudita.mmd.components.text.TextMMD
import java.util.Locale

/**
 * D3.3 three-section app shell: hosts the nav graph with a persistent MMD bottom navigation bar for
 * **Reader / Dictionary / Flashcards**. The bar is hidden on onboarding and inside the reader
 * (immersive full-screen reading) per [ShellNav.showBottomBar]. Switching a tab pops to the graph
 * start saving state, so each section keeps its own back stack.
 */
@Composable
fun AppShell(
    navController: NavHostController,
    startDestination: String,
) {
    val backStackEntry by navController.currentBackStackEntryAsState()
    val route = backStackEntry?.destination?.route
    Column(Modifier.fillMaxSize()) {
        Box(Modifier.weight(1f)) {
            MangaShelfNavHost(navController, startDestination)
        }
        if (ShellNav.showBottomBar(route)) {
            ShellBottomBar(
                selected = ShellNav.sectionForRoute(route),
                onSelect = { section ->
                    navController.navigate(section.root) {
                        popUpTo(navController.graph.findStartDestination().id) { saveState = true }
                        launchSingleTop = true
                        restoreState = true
                    }
                },
            )
        }
    }
}

const val NAV_TAG_PREFIX = "nav-"

@Composable
internal fun ShellBottomBar(selected: ShellSection?, onSelect: (ShellSection) -> Unit) {
    NavigationBarMMD {
        ShellSection.entries.forEach { section ->
            NavigationBarItemMMD(
                selected = section == selected,
                onClick = { onSelect(section) },
                icon = { TextMMD(section.glyph, fontFamily = NotoSansJp) },
                label = { TextMMD(section.label) },
                modifier = Modifier.testTag("$NAV_TAG_PREFIX${section.name.lowercase(Locale.ROOT)}"),
            )
        }
    }
}
