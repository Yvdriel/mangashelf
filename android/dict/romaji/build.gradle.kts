// :dict:romaji — romaji↔kana front-end. Thin wrapper over the pure-Kotlin WanaKana
// v4 port (dev.esnault.wanakana). Pure JVM → unit-testable off-device.
import org.jetbrains.kotlin.gradle.tasks.KotlinCompile

plugins {
    alias(libs.plugins.kotlin.jvm)
}

java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}

tasks.withType<KotlinCompile>().configureEach {
    kotlinOptions.jvmTarget = "17"
}

dependencies {
    implementation(libs.wanakana.core)
    testImplementation(libs.junit)
}
