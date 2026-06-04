package com.mangashelf.reader

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import androidx.navigation.compose.rememberNavController
import com.mangashelf.reader.data.store.TokenStore
import com.mangashelf.reader.ui.nav.MangaShelfNavHost
import com.mangashelf.reader.ui.nav.Routes
import com.mangashelf.reader.ui.theme.MangaShelfTheme
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    @Inject
    lateinit var tokenStore: TokenStore

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Skip onboarding when a validated token is already persisted (survives restart).
        val start = if (tokenStore.isOnboarded()) Routes.LIBRARY else Routes.ONBOARDING
        setContent {
            MangaShelfTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    val navController = rememberNavController()
                    MangaShelfNavHost(navController, startDestination = start)
                }
            }
        }
    }
}
