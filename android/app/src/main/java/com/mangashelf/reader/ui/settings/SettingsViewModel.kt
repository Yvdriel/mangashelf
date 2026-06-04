package com.mangashelf.reader.ui.settings

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import com.mangashelf.reader.data.local.DownloadDao
import com.mangashelf.reader.data.local.MangaDao
import com.mangashelf.reader.data.local.ProgressDao
import com.mangashelf.reader.data.local.VolumeDao
import com.mangashelf.reader.data.reader.ArchivePaths
import com.mangashelf.reader.data.store.SyncStateStore
import com.mangashelf.reader.data.store.TokenStore
import com.mangashelf.reader.sync.LibraryDeltaWorker
import com.mangashelf.reader.sync.ProgressSyncScheduler
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * CH.8/6.2 settings. Sync now triggers a one-shot library+progress sync and a progress push; Clear
 * cache deletes the downloaded archives (and unpins, so nothing silently re-downloads); Change server
 * purges everything (credentials, cache, local DB, cursors) and signals a return to Onboarding.
 */
@HiltViewModel
class SettingsViewModel @Inject constructor(
    @ApplicationContext private val context: Context,
    private val tokenStore: TokenStore,
    private val workManager: WorkManager,
    private val syncScheduler: ProgressSyncScheduler,
    private val syncState: SyncStateStore,
    private val mangaDao: MangaDao,
    private val volumeDao: VolumeDao,
    private val progressDao: ProgressDao,
    private val downloadDao: DownloadDao,
) : ViewModel() {

    val serverUrl: StateFlow<String?> = MutableStateFlow(tokenStore.serverUrl())

    private val _reonboard = MutableStateFlow(false)
    val reonboard: StateFlow<Boolean> = _reonboard.asStateFlow()

    fun syncNow() {
        val request = OneTimeWorkRequestBuilder<LibraryDeltaWorker>()
            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .build()
        workManager.enqueueUniqueWork("sync-now", ExistingWorkPolicy.REPLACE, request)
        syncScheduler.schedule() // flush any pending local progress
    }

    fun clearCache() {
        viewModelScope.launch {
            volumeDao.unpinAll()
            downloadDao.clearAll()
            ArchivePaths.root(context.filesDir).deleteRecursively()
        }
    }

    fun changeServer() {
        viewModelScope.launch {
            tokenStore.clear()
            ArchivePaths.root(context.filesDir).deleteRecursively()
            mangaDao.clearManga()
            volumeDao.clearVolumes()
            progressDao.clearProgress()
            downloadDao.clearAll()
            syncState.clear()
            _reonboard.value = true
        }
    }
}
