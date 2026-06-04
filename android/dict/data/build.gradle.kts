// :dict:data — CH.6 Android data layer over the prebaked dict.db (CH.2, ~930 MB trim).
// Raw DAO over SupportSQLiteOpenHelper (requery's bundled SQLite → guaranteed FTS5), NOT Room:
// Room 2.6.1 has no @Fts5 for the gloss_fts virtual table, and the hand-baked DB has no
// room_master_table (user_version=0) so Room's identity-hash check would reject it.
plugins {
    alias(libs.plugins.android.library)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.kapt)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.hilt)
}

android {
    namespace = "com.mangashelf.dict.data"
    compileSdk = 35

    defaultConfig {
        minSdk = 28
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        // arm64-only: Mudita Kompakt is Helio A22; requery ships an arm64-v8a libsqlite3x.so.
        ndk {
            abiFilters += "arm64-v8a"
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
        // androidx.sqlite 2.5.x is built with a Kotlin newer than this module's 1.9.22 compiler;
        // the bytecode is JVM-compatible, only the metadata-version gate trips (same wrinkle as
        // the Anki AAR in :app). Bundled SQLite driver is plain synchronous API — no codegen.
        freeCompilerArgs += "-Xskip-metadata-version-check"
    }

    // Never deflate the prebaked .db asset — keeps the packaged size flat and the first-run
    // copy a straight byte stream (a compressed >1 MB asset can't be opened as a file either).
    androidResources {
        noCompress += "db"
    }
}

dependencies {
    implementation(project(":dict:engine"))
    implementation(project(":dict:romaji"))

    implementation(libs.kotlinx.coroutines.android)
    implementation(libs.kotlinx.serialization.json)

    implementation(libs.hilt.android)
    kapt(libs.hilt.compiler)

    implementation(libs.androidx.sqlite)
    implementation(libs.androidx.sqlite.bundled)

    testImplementation(libs.junit)

    androidTestImplementation(libs.androidx.test.junit)
    androidTestImplementation(libs.androidx.test.runner)
    androidTestImplementation(libs.androidx.test.core)
}

// Match :app: the requery / androidx deps can drag a newer kotlin-stdlib than the
// MMD-proven 1.9.22 compiler accepts. Pin it.
configurations.all {
    resolutionStrategy {
        force("org.jetbrains.kotlin:kotlin-stdlib:${libs.versions.kotlin.get()}")
    }
}

kapt {
    correctErrorTypes = true
}
