package com.mangashelf.reader.flashcards.data.model

/** The single global scheduler preset surfaced by F.5 settings. */
data class SchedulerSettings(
    val rolloverHour: Int,        // "next day starts at", 0..23 (default 4)
    val newPerDay: Int,           // default 20
    val reviewsPerDay: Int,       // default 200
    val fsrsEnabled: Boolean,
    val desiredRetention: Float,  // default 0.90
) {
    companion object {
        val DEFAULT = SchedulerSettings(
            rolloverHour = 4,
            newPerDay = 20,
            reviewsPerDay = 200,
            fsrsEnabled = true,
            desiredRetention = 0.90f,
        )
    }
}
