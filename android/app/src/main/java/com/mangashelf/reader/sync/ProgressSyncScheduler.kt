package com.mangashelf.reader.sync

import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit
import javax.inject.Inject

/**
 * Debounces the progress push (CH.8/5.3). Each local write calls [schedule]; the unique `progress-sync`
 * work is REPLACEd with a fresh 5s delay, so a burst of page turns collapses into a single batch POST
 * 5s after the last write. Abstracted behind an interface so [ProgressRepository] is unit-testable
 * with a no-op (no WorkManager on a host JVM).
 */
fun interface ProgressSyncScheduler {
    fun schedule()
}

class WorkProgressSyncScheduler @Inject constructor(
    private val workManager: WorkManager,
) : ProgressSyncScheduler {

    override fun schedule() {
        val request = OneTimeWorkRequestBuilder<SyncProgressWorker>()
            .setConstraints(
                Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build(),
            )
            .setInitialDelay(DEBOUNCE_SECONDS, TimeUnit.SECONDS)
            .build()
        workManager.enqueueUniqueWork(UNIQUE_NAME, ExistingWorkPolicy.REPLACE, request)
    }

    companion object {
        const val UNIQUE_NAME = "progress-sync"
        const val DEBOUNCE_SECONDS = 5L
    }
}
