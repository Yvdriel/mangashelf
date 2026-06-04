plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.kapt)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.hilt)
}

android {
    namespace = "com.mangashelf.reader"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.mangashelf.reader"
        minSdk = 28
        targetSdk = 35
        versionCode = 1
        versionName = "1.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"

        // arm64-only: Mudita Kompakt is Helio A22 (arm64-v8a); also what the rsdroid
        // native backend (F.1) needs. Drops other-ABI native code.
        ndk {
            abiFilters += "arm64-v8a"
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
        freeCompilerArgs += "-opt-in=kotlin.RequiresOptIn"
        // The Anki backend AAR's own .class files carry Kotlin metadata 2.1.0, which is two
        // versions ahead of this module's 1.9.22 compiler (it reads up to current+1 = 2.0.0).
        // The bytecode is JVM-compatible; only the metadata version gate trips. Skipping the
        // check lets 1.9.22 consume the 2.1.x-built backend. (F.1 spike integration wrinkle.)
        freeCompilerArgs += "-Xskip-metadata-version-check"
    }

    buildFeatures {
        compose = true
    }

    composeOptions {
        kotlinCompilerExtensionVersion = libs.versions.composeCompiler.get()
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }

    // Room exports v1 schema JSON here; the androidTest asset dir lets MigrationTestHelper read it.
    sourceSets {
        getByName("androidTest").assets.srcDir("$projectDir/schemas")
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.core.splashscreen)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.activity.compose)

    implementation(libs.compose.ui)
    implementation(libs.compose.ui.tooling.preview)
    implementation(libs.compose.material.icons.extended)
    implementation(libs.compose.material3)
    implementation(libs.android.material)
    implementation(libs.mmd)

    implementation(libs.androidx.navigation.compose)
    implementation(libs.androidx.hilt.navigation.compose)
    implementation(libs.androidx.datastore.preferences)

    implementation(libs.kotlinx.coroutines.android)
    implementation(libs.kotlinx.serialization.json)

    implementation(libs.hilt.android)
    kapt(libs.hilt.compiler)
    implementation(libs.androidx.hilt.work)
    kapt(libs.androidx.hilt.compiler)

    implementation(libs.room.runtime)
    implementation(libs.room.ktx)
    kapt(libs.room.compiler)

    // Dictionary pillar data layer (CH.6): DictEngine over the prebaked dict.db.
    implementation(project(":dict:data"))

    implementation(libs.retrofit)
    implementation(libs.retrofit.converter.kotlinx.serialization)
    implementation(libs.okhttp)
    implementation(libs.okhttp.logging)

    implementation(libs.androidx.work.runtime.ktx)

    // CH.4 client data plane: Coil covers (authed OkHttp) + EncryptedSharedPreferences token store.
    implementation(libs.coil.compose)
    implementation(libs.androidx.security.crypto)

    // Flashcards (F.1 spike): Anki Rust backend AAR — bundles arm64-v8a librsdroid.so
    // and ~2665 pre-generated anki.* protobuf classes (no Wire/protoc codegen needed).
    implementation(libs.anki.backend)

    testImplementation(libs.junit)
    // Real org.json for JVM unit tests (Android stubs throw "not mocked"); prod uses the
    // Android-bundled org.json with the same API. Used by the MiningNotetype JSON transform test.
    testImplementation("org.json:json:20240303")
    // Host-JVM tier: bundles librsdroid.dylib/.so + RustBackendLoader.ensureSetup().
    testImplementation(libs.anki.backend.testing)
    // CH.4: MockWebServer for AuthInterceptor/AuthValidator JVM tests; coroutines-test for flows.
    testImplementation(libs.okhttp.mockwebserver)
    testImplementation(libs.kotlinx.coroutines.test)
    androidTestImplementation(libs.androidx.test.junit)
    androidTestImplementation(libs.androidx.test.runner)
    androidTestImplementation(libs.androidx.test.core)
    androidTestImplementation(libs.espresso.core)
    androidTestImplementation(libs.compose.ui.test.junit4)
    // CH.4: Room DAO/flow + WorkManager worker instrumented tests.
    androidTestImplementation(libs.room.testing)
    androidTestImplementation(libs.androidx.work.testing)
    androidTestImplementation(libs.kotlinx.coroutines.test)
    debugImplementation(libs.compose.ui.tooling)
    debugImplementation(libs.compose.ui.test.manifest)
}

// The Anki backend AAR pulls kotlin-stdlib:2.1.10, but this module compiles with
// Kotlin 1.9.22 (MMD-proven matrix). Pin the stdlib to the compiler version to avoid
// a "newer than compiler" metadata mismatch.
configurations.all {
    resolutionStrategy {
        force("org.jetbrains.kotlin:kotlin-stdlib:${libs.versions.kotlin.get()}")
    }
}

kapt {
    correctErrorTypes = true
    arguments {
        arg("room.schemaLocation", "$projectDir/schemas")
    }
}
