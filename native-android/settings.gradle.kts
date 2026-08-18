// settings.gradle.kts — VibeCore Univers Android Build Host (Integration Gate, Baseline 1.1)
// ANNAHME (dokumentiert): Gradle 8.7 / AGP 8.5.2 / Kotlin 1.9.24 — kompatibel mit
// compileSdk 34 + Java 17 (app/build.gradle.kts). Im Repo ist keine Version vorgegeben.
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
    }
}
rootProject.name = "VibeCoreUnivers"
include(":app")
