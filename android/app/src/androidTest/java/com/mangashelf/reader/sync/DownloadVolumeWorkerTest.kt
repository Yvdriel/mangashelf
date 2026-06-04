package com.mangashelf.reader.sync

import android.content.Context
import androidx.room.Room
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.work.ListenableWorker
import androidx.work.WorkerFactory
import androidx.work.WorkerParameters
import androidx.work.testing.TestListenableWorkerBuilder
import androidx.work.workDataOf
import com.mangashelf.reader.data.local.MangaShelfDatabase
import com.mangashelf.reader.data.local.entities.DownloadState
import com.mangashelf.reader.data.reader.ArchivePaths
import com.mangashelf.reader.data.remote.MangaShelfApi
import com.mangashelf.reader.data.remote.dto.LibraryResponseDto
import com.mangashelf.reader.data.remote.dto.WhoamiDto
import kotlinx.coroutines.test.runTest
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.ResponseBody
import okhttp3.ResponseBody.Companion.toResponseBody
import okio.Buffer
import okio.Source
import okio.Timeout
import okio.buffer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import retrofit2.Response
import java.io.ByteArrayOutputStream
import java.io.IOException
import java.util.zip.ZipEntry
import java.util.zip.ZipFile
import java.util.zip.ZipOutputStream

/**
 * CH.8/5.1 gate anchor (kompakt28): the download worker writes a valid CBZ **atomically** to the exact
 * reader path, and survives a mid-stream network drop (IOException → retry → success on reconnect)
 * without ever leaving a half-file at the final path.
 */
@RunWith(AndroidJUnit4::class)
class DownloadVolumeWorkerTest {

    private lateinit var ctx: Context
    private lateinit var db: MangaShelfDatabase
    private lateinit var api: FakeApi

    private val mangaId = 9
    private val volumeNumber = 1

    private fun finalCbz() = ArchivePaths.cbz(ctx.filesDir, mangaId, volumeNumber)

    @Before
    fun setup() {
        ctx = InstrumentationRegistry.getInstrumentation().targetContext
        db = Room.inMemoryDatabaseBuilder(ctx, MangaShelfDatabase::class.java).build()
        api = FakeApi()
        ArchivePaths.dir(ctx.filesDir, mangaId).deleteRecursively()
    }

    @After
    fun teardown() {
        db.close()
        ArchivePaths.dir(ctx.filesDir, mangaId).deleteRecursively()
    }

    @Test
    fun validArchive_writesCbzAtReaderPath_andMarksDownloaded() = runTest {
        api.archiveResponse = { Response.success(validZipBody(pages = 3)) }

        assertEquals(ListenableWorker.Result.success(), buildWorker().doWork())

        val cbz = finalCbz()
        assertTrue("CBZ exists at the reader path", cbz.exists())
        ZipFile(cbz).use { assertEquals(3, it.size()) }
        val row = db.downloadDao().get(mangaId, volumeNumber)
        assertEquals(DownloadState.DOWNLOADED, row?.state)
    }

    @Test
    fun networkDropMidStream_retries_andNeverLeavesHalfFileAtFinalPath() = runTest {
        api.archiveResponse = { Response.success(throwingBody(prefix = ByteArray(64))) }

        assertEquals(ListenableWorker.Result.retry(), buildWorker().doWork())

        assertFalse("no half-written file at the final path", finalCbz().exists())
    }

    @Test
    fun resume_afterDrop_secondRunSucceeds() = runTest {
        // Run 1: connection drops mid-stream → retry, no final file.
        api.archiveResponse = { Response.success(throwingBody(prefix = ByteArray(64))) }
        assertEquals(ListenableWorker.Result.retry(), buildWorker().doWork())
        assertFalse(finalCbz().exists())

        // Run 2: reconnected → full archive → success, valid CBZ.
        api.archiveResponse = { Response.success(validZipBody(pages = 2)) }
        assertEquals(ListenableWorker.Result.success(), buildWorker().doWork())
        ZipFile(finalCbz()).use { assertEquals(2, it.size()) }
    }

    @Test
    fun ocrSidecar_present_isDownloadedBesideCbz() = runTest {
        api.archiveResponse = { Response.success(validZipBody(pages = 2)) }
        api.ocrResponse = { Response.success("""{"version":"2.0","pages":[]}""".toResponseBody("application/json".toMediaType())) }

        assertEquals(ListenableWorker.Result.success(), buildWorker().doWork())

        val mokuro = ArchivePaths.mokuro(ctx.filesDir, mangaId, volumeNumber)
        assertTrue("mokuro sidecar lands beside the CBZ", mokuro.exists())
        assertTrue(finalCbz().exists())
    }

    @Test
    fun ocrSidecar_404_isSkippedSilently_andVolumeStillSucceeds() = runTest {
        api.archiveResponse = { Response.success(validZipBody(pages = 2)) }
        api.ocrResponse = { Response.error(404, "".toResponseBody("application/json".toMediaType())) }

        assertEquals(ListenableWorker.Result.success(), buildWorker().doWork())

        assertFalse("no sidecar when the volume isn't OCR'd", ArchivePaths.mokuro(ctx.filesDir, mangaId, volumeNumber).exists())
        assertTrue("the CBZ still downloads", finalCbz().exists())
    }

    @Test
    fun clientError_marksFailed_andDoesNotRetry() = runTest {
        api.archiveResponse = { Response.error(404, "".toResponseBody("application/json".toMediaType())) }

        assertEquals(ListenableWorker.Result.failure(), buildWorker().doWork())

        assertFalse(finalCbz().exists())
        assertEquals(DownloadState.FAILED, db.downloadDao().get(mangaId, volumeNumber)?.state)
    }

    // --- harness ---------------------------------------------------------------------------------

    private fun buildWorker(): DownloadVolumeWorker =
        TestListenableWorkerBuilder<DownloadVolumeWorker>(ctx)
            .setInputData(workDataOf("mangaId" to mangaId, "volumeNumber" to volumeNumber))
            .setWorkerFactory(object : WorkerFactory() {
                override fun createWorker(
                    appContext: Context,
                    workerClassName: String,
                    workerParameters: WorkerParameters,
                ): ListenableWorker =
                    DownloadVolumeWorker(appContext, workerParameters, api, db.downloadDao())
            })
            .build()

    private class FakeApi : MangaShelfApi {
        var archiveResponse: () -> Response<ResponseBody> = { Response.success(ByteArray(0).toResponseBody()) }
        var ocrResponse: () -> Response<ResponseBody> =
            { Response.error(404, "".toResponseBody("application/json".toMediaType())) }
        override suspend fun whoami(): WhoamiDto = throw UnsupportedOperationException()
        override suspend fun library(changedSince: Long?): LibraryResponseDto = throw UnsupportedOperationException()
        override suspend fun archive(mangaId: Int, volumeNumber: Int): Response<ResponseBody> = archiveResponse()
        override suspend fun ocr(mangaId: Int, volumeNumber: Int): Response<ResponseBody> = ocrResponse()
        override suspend fun pushProgress(request: com.mangashelf.reader.data.remote.dto.ProgressBatchRequestDto) = throw UnsupportedOperationException()
        override suspend fun getProgress(changedSince: Long?) = throw UnsupportedOperationException()
    }

    private fun validZipBody(pages: Int): ResponseBody {
        val bytes = ByteArrayOutputStream().also { baos ->
            ZipOutputStream(baos).use { zip ->
                for (i in 1..pages) {
                    zip.putNextEntry(ZipEntry("%03d.jpg".format(i)))
                    zip.write(ByteArray(32) { it.toByte() })
                    zip.closeEntry()
                }
            }
        }.toByteArray()
        return bytes.toResponseBody("application/zip".toMediaType())
    }

    /** A body that emits [prefix], then throws — simulates a connection drop mid-download. */
    private fun throwingBody(prefix: ByteArray): ResponseBody {
        val source = object : Source {
            private var sent = false
            override fun read(sink: Buffer, byteCount: Long): Long {
                if (!sent) {
                    sent = true
                    sink.write(prefix)
                    return prefix.size.toLong()
                }
                throw IOException("connection dropped")
            }
            override fun timeout(): Timeout = Timeout.NONE
            override fun close() {}
        }
        return object : ResponseBody() {
            override fun contentType() = "application/zip".toMediaType()
            override fun contentLength() = 1_000_000L // claims far more than it delivers
            override fun source() = source.buffer()
        }
    }
}
