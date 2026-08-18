# BUILD VERIFICATION STATUS — native-android (Stand: 2026-08-18, Gate „Android Build Host" ausgeführt)

> **STATUS: BUILD-READY / RUNTIME UNVERIFIED.** Der minimale Build-Host ist
> jetzt im Repo (settings/build/gradle.properties, Wrapper-Properties,
> Manifest, VibeCoreApplication, MainActivity mit
> `addJavascriptInterface(bridge, "VibeCoreNative")`). Ein realer Gradle-/
> NDK-Build ist in dieser Umgebung unmöglich (kein Java, kein Gradle, kein
> Android SDK/NDK — per `which` verifiziert); kein Build-/Testresultat wurde
> simuliert. Gradle-Wrapper ist KOMPLETT eingecheckt (gradlew, gradlew.bat,
> gradle-wrapper.jar — offizielle Gradle-v8.7.0-Artefakte). Erforderlich
> extern: JDK 17, Android SDK (Platform 34), NDK, CMake 3.22.1; dann
> `./gradlew :app:assembleDebug`. Versionsannahmen (AGP 8.5.2,
> Kotlin 1.9.24, Gradle 8.7) sind in settings-/build.gradle.kts als
> ANNAHME dokumentiert. Zweites Host-Interface: `window.VibeCoreHost`
> (Mikrofon-Permission-Flow) neben `window.VibeCoreNative` (Audio).

> Evidenzbasierte Feststellung. Keine Architekturänderung vorgenommen —
> das Repl enthält das Android-Native-Modul absichtlich als **einzubettendes
> Modul**, nicht als eigenständig baubare App (so deklariert im Kopf von
> `native-android/app/build.gradle.kts`: „Wird außerhalb von Base44 in ein
> natives Android-App-Modul eingebunden.").

## 1. Exakter Build-Blocker (Ist-Zustand)

In diesem Repl ist ein `./gradlew assembleDebug` **nicht möglich**, weil folgende
Bestandteile fehlen (verifiziert per Dateisystem-Prüfung):

| Fehlt | Zweck |
|---|---|
| `settings.gradle(.kts)` (Root) | Modul-Registrierung (`include(":app")`) |
| `build.gradle(.kts)` (Root) | AGP-/Kotlin-Plugin-Klassenpfad |
| `gradle.properties` | AndroidX-Flags, JVM-Args |
| Gradle-Wrapper (`gradlew`, `gradle/wrapper/…`) | reproduzierbare Gradle-Version |
| `app/src/main/AndroidManifest.xml` | Pflichtdatei jedes Android-Moduls |
| Activity-/Application-Klasse (WebView-Host) | Laufzeit-Einstieg, registriert `NativeAudioBridge` |
| Android SDK/NDK + CMake 3.22.1 in der Umgebung | Kompilieren von Kotlin + C++ |

Vorhanden und konsistent: `app/build.gradle.kts` (compileSdk 34, NDK-ABIs,
Prefab/Oboe, CMake-Pfad) und `app/src/main/cpp/CMakeLists.txt` (v6.0.0, alle
Phase-1–6-Quellen).

## 2. Minimal notwendige externe Einbettungsanforderung

Ein aufnehmendes Android-Projekt muss mindestens bereitstellen:

1. Root-Gradle-Gerüst (settings/build/properties/wrapper) mit AGP ≥ 8.x,
   Kotlin-Android-Plugin, CMake 3.22.1, NDK.
2. `AndroidManifest.xml` mit `RECORD_AUDIO`-Permission (Voice-Live-Input;
   Runtime-Permission VOR `voiceSetLiveInputEnabled(true)` anfragen) und
   `INTERNET` für die WebView.
3. Eine Host-Activity mit WebView, die
   `webView.addJavascriptInterface(NativeAudioBridge(), "VibeCoreNative")`
   registriert und `NativeAudioBridge.load()`/Engine-Start aufruft.
   **Der Interface-Name `VibeCoreNative` ist verbindlich** (ADR-005 Decision C):
   `src/lib/audio/AudioBackend.ts` erkennt den nativen Pfad ausschließlich über
   `window.VibeCoreNative`.
4. Oboe als Prefab-Abhängigkeit (`com.google.oboe:oboe`), passend zu
   `buildFeatures { prefab = true }` im Modul.

## 3. Verifikationsstatus (ausdrücklich)

| Prüfung | Status |
|---|---|
| C++-Quellen (Phasen 1–6) Host-Syntaxvalidierung (g++, Stubs) | ✅ bestanden |
| JNI-Symbole ↔ Kotlin-Externals (Diff-Abgleich) | ✅ SYMBOLS-MATCH |
| Kotlin-Kompilierung (`NativeAudioBridge.kt`) | ❌ **NICHT VERIFIZIERT** (kein Kotlin-Compiler/AGP im Repl) |
| NDK-/CMake-Build der nativen Bibliothek | ❌ **NICHT VERIFIZIERT** (kein NDK im Repl) |
| Laufzeit-/Hardware-Tests (Latenz, CPU, Mikrofonpfad) | ❌ **NICHT VERIFIZIERT** (kein Gerät) |

Diese Nicht-Verifizierbarkeit ist umgebungsbedingt und bleibt bestehen, bis das
Modul extern eingebettet wird (siehe Task #36 in der Projektliste).
