package com.mangashelf.reader.data.remote

import com.mangashelf.reader.data.store.TokenStore
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory

/**
 * 2.2 acceptance: the [AuthInterceptor] takes the base URL from the [TokenStore] (Retrofit is built
 * with a placeholder host) and sets the `Authorization: Bearer …` header on every call.
 */
class AuthInterceptorTest {

    private lateinit var server: MockWebServer

    @Before
    fun setup() {
        server = MockWebServer()
        server.start()
    }

    @After
    fun teardown() {
        server.shutdown()
    }

    private class FakeTokenStore(
        private val url: String?,
        private val tok: String?,
    ) : TokenStore {
        override fun serverUrl() = url
        override fun token() = tok
        override fun save(serverUrl: String, token: String) = Unit
        override fun clear() = Unit
    }

    /** Retrofit built with a deliberately wrong host to prove the interceptor rebases to the store. */
    private fun apiFor(store: TokenStore): MangaShelfApi {
        val client = OkHttpClient.Builder().addInterceptor(AuthInterceptor(store)).build()
        val json = Json { ignoreUnknownKeys = true }
        return Retrofit.Builder()
            .baseUrl("http://wrong-host.invalid/")
            .client(client)
            .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
            .build()
            .create(MangaShelfApi::class.java)
    }

    @Test
    fun whoami_setsBearerHeader_andTakesBaseUrlFromStore() = runBlocking {
        server.enqueue(
            MockResponse().setBody("""{"userId":"u1","name":"Alice","email":"a@b.c"}"""),
        )
        val api = apiFor(FakeTokenStore(server.url("/").toString(), "mst_test"))

        val who = api.whoami()
        assertEquals("u1", who.userId)

        val recorded = server.takeRequest()
        assertEquals("/api/v1/auth/whoami", recorded.path)
        assertEquals("Bearer mst_test", recorded.getHeader("Authorization"))
    }

    @Test
    fun library_passesChangedSinceQuery_andBearer() = runBlocking {
        server.enqueue(MockResponse().setBody("""{"serverTime":100,"manga":[]}"""))
        val api = apiFor(FakeTokenStore(server.url("/").toString(), "mst_x"))

        api.library(changedSince = 42L)

        val recorded = server.takeRequest()
        assertEquals("/api/v1/library?changedSince=42", recorded.path)
        assertEquals("Bearer mst_x", recorded.getHeader("Authorization"))
    }
}
