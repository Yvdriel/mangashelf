package com.mangashelf.reader.data.remote

import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * 2.3 acceptance (validation half): a good token validates to the identity; a 401 is a failure. The
 * validator hits whoami with the explicit creds and never persists anything.
 */
class AuthValidatorTest {

    private lateinit var server: MockWebServer
    private val validator = AuthValidator(Json { ignoreUnknownKeys = true })

    @Before
    fun setup() {
        server = MockWebServer()
        server.start()
    }

    @After
    fun teardown() {
        server.shutdown()
    }

    @Test
    fun goodToken_returnsIdentity_andCallsWhoamiWithBearer() = runBlocking {
        server.enqueue(
            MockResponse().setBody("""{"userId":"u1","name":"Alice","email":"a@b.c"}"""),
        )

        val result = validator.validate(server.url("/").toString(), "mst_good")

        assertTrue(result.isSuccess)
        assertEquals("u1", result.getOrThrow().userId)

        val recorded = server.takeRequest()
        assertEquals("/api/v1/auth/whoami", recorded.path)
        assertEquals("Bearer mst_good", recorded.getHeader("Authorization"))
    }

    @Test
    fun badToken_401_isFailure() = runBlocking {
        server.enqueue(MockResponse().setResponseCode(401).setBody("""{"error":"Unauthorized"}"""))

        val result = validator.validate(server.url("/").toString(), "mst_bad")

        assertTrue(result.isFailure)
    }
}
