package com.mangashelf.reader.flashcards

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.mangashelf.reader.flashcards.data.AnkiBackend
import com.mangashelf.reader.flashcards.data.CollectionRepository
import com.mangashelf.reader.flashcards.data.model.SchedulerSettings
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File

/** F.5 acceptance (instrumented): scheduler settings persist and read back. */
@RunWith(AndroidJUnit4::class)
class SchedulerSettingsDataTest {

    private lateinit var dir: File
    private lateinit var repo: CollectionRepository

    @Before
    fun setup() {
        val ctx = InstrumentationRegistry.getInstrumentation().targetContext
        dir = File(ctx.filesDir, "test_settings_${System.nanoTime()}")
        dir.deleteRecursively()
        repo = CollectionRepository(AnkiBackend(), dir)
    }

    @After
    fun teardown() {
        repo.close()
        dir.deleteRecursively()
    }

    @Test
    fun updateThenRead_roundTripsSettings() = runBlocking {
        repo.bootstrap()
        repo.updateSchedulerSettings(
            SchedulerSettings(
                rolloverHour = 6,
                newPerDay = 33,
                reviewsPerDay = 222,
                fsrsEnabled = true,
                desiredRetention = 0.85f,
            ),
        )
        val read = repo.schedulerSettings()
        assertEquals(6, read.rolloverHour)
        assertEquals(33, read.newPerDay)
        assertEquals(222, read.reviewsPerDay)
        assertTrue(read.fsrsEnabled)
        assertEquals(0.85f, read.desiredRetention, 0.0001f)
    }

    @Test
    fun fsrsCanBeToggledOff() = runBlocking {
        repo.bootstrap()
        repo.updateSchedulerSettings(SchedulerSettings.DEFAULT.copy(fsrsEnabled = false))
        assertFalse(repo.schedulerSettings().fsrsEnabled)
    }
}
