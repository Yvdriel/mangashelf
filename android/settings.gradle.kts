pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
        // Mudita Mindful Design (MMD) e-ink Compose component library
        maven { url = uri("https://mudita.jfrog.io/artifactory/mmd-release") }
    }
}

rootProject.name = "MangaShelfReader"
include(":app")
// Dictionary pillar (CH.2) — pure-Kotlin/JVM logic modules, fully unit-testable
// off-device. :dict:engine = deinflector + forward conjugator; :dict:romaji = wanakana.
include(":dict:engine")
include(":dict:romaji")
