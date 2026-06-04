package com.mangashelf.reader.data.store

import okhttp3.HttpUrl.Companion.toHttpUrlOrNull

/**
 * Normalizes a user-entered server address into an **origin** (`scheme://host[:port]`): trims
 * whitespace, defaults to `http://` (self-hosted readers are usually plain HTTP on a LAN), and
 * drops any path/query/fragment. Stripping to the origin keeps the onboarding validator and the
 * AuthInterceptor (which rewrites only scheme/host/port) in agreement — a pasted `host/some/path`
 * can't make onboarding pass against a path that runtime API calls then ignore.
 */
fun normalizeServerUrl(raw: String): String {
    val trimmed = raw.trim()
    val withScheme =
        if (trimmed.startsWith("http://", ignoreCase = true) ||
            trimmed.startsWith("https://", ignoreCase = true)
        ) {
            trimmed
        } else {
            "http://$trimmed"
        }
    val url = withScheme.toHttpUrlOrNull() ?: return withScheme.trimEnd('/')
    val isDefaultPort =
        (url.scheme == "http" && url.port == 80) || (url.scheme == "https" && url.port == 443)
    return if (isDefaultPort) "${url.scheme}://${url.host}" else "${url.scheme}://${url.host}:${url.port}"
}
