package com.mangashelf.reader.data.store

/**
 * Persisted device credentials for the self-hosted server: base URL + bearer token.
 *
 * Reads are synchronous because the OkHttp [com.mangashelf.reader.data.remote.AuthInterceptor]
 * runs on the calling network thread and cannot suspend. Backed by EncryptedSharedPreferences in
 * production ([EncryptedTokenStore]); a fake is injected in JVM tests.
 */
interface TokenStore {
    /** The server origin (`http(s)://host[:port]`), normalized on save, or null when not onboarded. */
    fun serverUrl(): String?

    /** The bearer token (`mst_…`), or null when not onboarded. */
    fun token(): String?

    /** True once both a server URL and a token are stored. */
    fun isOnboarded(): Boolean = serverUrl() != null && token() != null

    /** Persists validated credentials. [serverUrl] is normalized; [token] is trimmed. */
    fun save(serverUrl: String, token: String)

    /** Wipes stored credentials (logout / 401 recovery). */
    fun clear()
}
