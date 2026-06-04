package com.mangashelf.reader.data.remote

import com.mangashelf.reader.data.store.TokenStore
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.Interceptor
import okhttp3.Response

/**
 * Retargets every outgoing request at the server origin stored in [TokenStore] and attaches the
 * bearer token. Retrofit (and the Coil ImageLoader) are built with a placeholder base URL, so the
 * real scheme/host/port are supplied here at call time — which is how a single client survives the
 * server URL changing without rebuilding Retrofit. Sharing this client with Coil means cover
 * requests are authenticated for free.
 *
 * When no credentials are stored the request is left untouched (it will fail / 401), which only
 * happens before onboarding completes.
 */
class AuthInterceptor(private val tokenStore: TokenStore) : Interceptor {

    override fun intercept(chain: Interceptor.Chain): Response {
        val original = chain.request()
        val builder = original.newBuilder()

        tokenStore.serverUrl()?.toHttpUrlOrNull()?.let { base ->
            builder.url(
                original.url.newBuilder()
                    .scheme(base.scheme)
                    .host(base.host)
                    .port(base.port)
                    .build(),
            )
        }

        tokenStore.token()?.let { builder.header("Authorization", "Bearer $it") }

        return chain.proceed(builder.build())
    }
}
