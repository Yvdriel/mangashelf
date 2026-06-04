package com.mangashelf.reader.data.store

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

/**
 * [TokenStore] backed by EncryptedSharedPreferences (AES256-GCM values, AES256-SIV keys) so the
 * bearer token never sits in plaintext on disk. The prefs handle is created lazily — building the
 * master key touches the Android keystore, which we defer off the constructor.
 */
class EncryptedTokenStore(context: Context) : TokenStore {

    private val prefs by lazy {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        EncryptedSharedPreferences.create(
            context,
            FILE_NAME,
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
        )
    }

    override fun serverUrl(): String? = prefs.getString(KEY_URL, null)

    override fun token(): String? = prefs.getString(KEY_TOKEN, null)

    override fun save(serverUrl: String, token: String) {
        prefs.edit()
            .putString(KEY_URL, normalizeServerUrl(serverUrl))
            .putString(KEY_TOKEN, token.trim())
            .apply()
    }

    override fun clear() {
        prefs.edit().clear().apply()
    }

    private companion object {
        const val FILE_NAME = "mangashelf_secure_prefs"
        const val KEY_URL = "server_url"
        const val KEY_TOKEN = "token"
    }
}
