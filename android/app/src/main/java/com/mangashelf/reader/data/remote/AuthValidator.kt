package com.mangashelf.reader.data.remote

import com.mangashelf.reader.data.remote.dto.WhoamiDto
import com.mangashelf.reader.data.store.normalizeServerUrl
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import okhttp3.OkHttpClient
import okhttp3.Request
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Validates entered credentials by calling whoami directly with an explicit URL + token. It uses a
 * **bare** OkHttp client (not the DI [com.mangashelf.reader.data.remote.AuthInterceptor] one) and
 * never touches the [com.mangashelf.reader.data.store.TokenStore], so credentials only persist
 * after they are proven good — and re-onboarding isn't poisoned by previously stored creds.
 */
@Singleton
class AuthValidator @Inject constructor(private val json: Json) {

    private val client = OkHttpClient()

    /** [Result.success] with the identity on HTTP 200, [Result.failure] on any non-2xx or I/O error. */
    suspend fun validate(serverUrl: String, token: String): Result<WhoamiDto> =
        withContext(Dispatchers.IO) {
            val base = normalizeServerUrl(serverUrl)
            val request = Request.Builder()
                .url("$base/api/v1/auth/whoami")
                .header("Authorization", "Bearer ${token.trim()}")
                .build()
            runCatching {
                client.newCall(request).execute().use { resp ->
                    val body = resp.body?.string().orEmpty()
                    check(resp.isSuccessful) { "HTTP ${resp.code}" }
                    json.decodeFromString(WhoamiDto.serializer(), body)
                }
            }
        }
}
