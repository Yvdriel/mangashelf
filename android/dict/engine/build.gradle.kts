// :dict:engine — pure-Kotlin/JVM deinflection + forward conjugation logic, ported
// from src/lib/dict/transforms/**. Zero Android deps → fast plain-JUnit tests.
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
    testImplementation(libs.junit)
}
