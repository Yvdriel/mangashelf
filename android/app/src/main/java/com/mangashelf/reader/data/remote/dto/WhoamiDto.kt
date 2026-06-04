package com.mangashelf.reader.data.remote.dto

import kotlinx.serialization.Serializable

/** Response of `GET /api/v1/auth/whoami` — identity behind the bearer token (onboarding probe). */
@Serializable
data class WhoamiDto(
    val userId: String,
    val name: String,
    val email: String,
)
