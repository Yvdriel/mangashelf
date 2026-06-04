package com.mangashelf.reader.data.store

/**
 * Normalizes a user-entered server address into an origin: trims whitespace, drops a trailing
 * slash, and defaults to `http://` (self-hosted readers are usually plain HTTP on a LAN). Shared
 * by [EncryptedTokenStore.save] and the onboarding validator so the stored URL and the validation
 * call agree.
 */
fun normalizeServerUrl(raw: String): String {
    val trimmed = raw.trim().trimEnd('/')
    return when {
        trimmed.startsWith("http://", ignoreCase = true) -> trimmed
        trimmed.startsWith("https://", ignoreCase = true) -> trimmed
        else -> "http://$trimmed"
    }
}
