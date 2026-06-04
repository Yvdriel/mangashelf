package com.mangashelf.reader

import android.os.Bundle
import android.view.KeyEvent
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Modifier
import androidx.navigation.compose.rememberNavController
import com.mangashelf.reader.data.reader.VolumeKeys
import com.mangashelf.reader.data.remote.AuthEventBus
import com.mangashelf.reader.data.store.TokenStore
import com.mangashelf.reader.ui.nav.AppShell
import com.mangashelf.reader.ui.nav.Routes
import com.mangashelf.reader.ui.reader.ReaderKeyBus
import com.mangashelf.reader.ui.theme.MangaShelfTheme
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    @Inject
    lateinit var tokenStore: TokenStore

    @Inject
    lateinit var readerKeyBus: ReaderKeyBus

    @Inject
    lateinit var authEventBus: AuthEventBus

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Skip onboarding when a validated token is already persisted (survives restart).
        val start = if (tokenStore.isOnboarded()) Routes.LIBRARY else Routes.ONBOARDING
        setContent {
            MangaShelfTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    val navController = rememberNavController()
                    // 6.2: a revoked token (any 401) boots back to Onboarding. Downloads on disk stay.
                    LaunchedEffect(Unit) {
                        authEventBus.events.collect {
                            navController.navigate(Routes.ONBOARDING) {
                                popUpTo(navController.graph.id) { inclusive = true }
                            }
                        }
                    }
                    AppShell(navController, startDestination = start)
                }
            }
        }
    }

    /**
     * The Kompakt's only physical navigation is the volume rocker (no D-pad / page buttons). While
     * the reader is active, volume keys advance pages and are consumed (so the volume UI never
     * appears); everywhere else they fall through to normal system handling.
     */
    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        val direction = VolumeKeys.directionFor(keyCode)
        if (readerKeyBus.readerActive && direction != null) {
            readerKeyBus.emit(direction)
            return true
        }
        return super.onKeyDown(keyCode, event)
    }
}
