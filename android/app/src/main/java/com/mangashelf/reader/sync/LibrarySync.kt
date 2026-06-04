package com.mangashelf.reader.sync

import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Schedules [LibraryDeltaWorker]: a 6-hour periodic background sync (KEEP, so re-entering the
 * library doesn't reset the schedule) and a one-shot "Sync now" (REPLACE, so a tap supersedes an
 * in-flight manual run).
 */
@Singleton
class LibrarySync @Inject constructor(private val workManager: WorkManager) {

    fun enqueuePeriodic() {
        workManager.enqueueUniquePeriodicWork(
            PERIODIC,
            ExistingPeriodicWorkPolicy.KEEP,
            PeriodicWorkRequestBuilder<LibraryDeltaWorker>(6, TimeUnit.HOURS).build(),
        )
    }

    fun refreshNow() {
        workManager.enqueueUniqueWork(
            ONESHOT,
            ExistingWorkPolicy.REPLACE,
            OneTimeWorkRequestBuilder<LibraryDeltaWorker>().build(),
        )
    }

    private companion object {
        const val PERIODIC = "library_delta_periodic"
        const val ONESHOT = "library_delta_oneshot"
    }
}
