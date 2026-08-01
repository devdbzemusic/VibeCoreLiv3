// app/build.gradle.kts — NDK/CMake + Oboe (Prefab) für VibeCore-Android.
// Wird außerhalb von Base44 in ein natives Android-App-Modul eingebunden.
plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.vibecore.audio"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.vibecore.app"
        minSdk = 21            // Oboe fällt unter API 27 auf OpenSL ES zurück
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"

        ndk {
            abiFilters += listOf("arm64-v8a", "armeabi-v7a", "x86_64")
        }
        externalNativeBuild {
            cmake {
                cppFlags += "-std=c++17"
                arguments += "-DANDROID_STL=c++_shared"
            }
        }
    }

    externalNativeBuild {
        cmake {
            path = file("src/main/cpp/CMakeLists.txt")
            version = "3.22.1"
        }
    }

    buildFeatures {
        prefab = true   // aktiviert Oboe-AAR-Prefab-Verlinkung
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}

dependencies {
    // Oboe (Google) — native C++-Bibliothek als Prefab-AAR.
    implementation("com.google.oboe:oboe:1.9.0")

    implementation("androidx.webkit:webkit:1.11.0")
    implementation("androidx.core:core-ktx:1.13.1")
}