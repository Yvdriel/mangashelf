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
        // Mudita Mindful Design (MMD) e-ink Compose component library.
        // Scoped to com.mudita — the jfrog repo returns an HTML 404 page for any other
        // coordinate, which Gradle fails to parse as a POM ("Already seen doctype") and
        // aborts resolution instead of falling through to the next repo.
        maven {
            url = uri("https://mudita.jfrog.io/artifactory/mmd-release")
            content { includeGroup("com.mudita") }
        }
    }
}

rootProject.name = "MangaShelfReader"
include(":app")
// Dictionary pillar (CH.2) — pure-Kotlin/JVM logic modules, fully unit-testable
// off-device. :dict:engine = deinflector + forward conjugator; :dict:romaji = wanakana.
include(":dict:engine")
include(":dict:romaji")
// CH.6 — Android data layer over the prebaked dict.db: DAO + DictEngine contract +
// StructuredContent model. Raw DAO over androidx.sqlite BundledSQLiteDriver (bundled FTS5), NOT Room.
include(":dict:data")
