# VibeCore — Native Oboe Audio Backend (outside Base44)

Oboe ist eine native C++-Bibliothek (AAudio/OpenSL ES) und läuft **nicht** in einem
WebView. Dieser Ordner enthält das native Android-Backend, das separat in
Android Studio gebaut und als WebView-JavaScript-Interface (`window.VibeCoreNative`)
in die gepackte Base44-App injiziert wird. Im Browser fällt die Web-App auf die
bestehende Web-Audio-Engine zurück.

## Architektur

```
Base44 Web-App (React/Vite, Web Audio)
        │  window.VibeCoreNative?  ── nein → WebAudioBackend (bestehend)
        │  ───────────────────────  ja  → NativeOboeBackend (JS-Brücke)
        ▼
  @JavascriptInterface  (Kotlin, NativeAudioBridge.kt)
        │  external fun ... (JNI)
        ▼
  jni_bridge.cpp  (C++)
        ▼
  vibecore_engine.cpp  (Oboe: AAudio-Stream, Echtzeit-Mix-Callback)
```

Die Web-App bleibt Sequenz-Source-of-Truth und triggert pro Step einen Voice
(`trigger(slot, semitones, velocity, loop)`). Das native Backend übernimmt den
niedrig-latenten Render-Pfad auf dem Oboe-Echtzeit-Thread.

## Voraussetzungen

- Android Studio (Hedgehog+), NDK 26+, CMake 3.22+
- Min SDK 21 (AAudio ab API 27; Oboe fällt darunter auf OpenSL ES zurück)
- Testgerät ab Android 8.0 für den niedrigsten Latenz-Pfad (AAudio + Exclusive)

## Integration (Schritt für Schritt)

1. **Oboe-Abhängigkeit** — in `app/build.gradle.kts` ist `com.google.oboe:oboe`
   bereits hinterlegt (prefab). Version ggf. anheben.
2. **Modul einbinden** — kopiere `app/src/main/cpp/*` und
   `app/src/main/java/com/vibecore/audio/*` in dein Android-App-Modul.
3. **WebView-Interface registrieren** — in der Activity, die den Base44-WebView
   hostet:
   ```kotlin
   webView.settings.javaScriptEnabled = true
   webView.addJavascriptInterface(NativeAudioBridge(), "VibeCoreNative")
   webView.loadUrl("https://deine-base44-app-url")
   ```
4. **Build** — `./gradlew :app:assembleDebug` baut CMake + JNI + Oboe.
5. **Web-Seite** — in der Base44-App `createAudioBackend()` nutzen (erkennt
   `window.VibeCoreNative` automatisch).

## Latenz messen

Nutze die offizielle OboeTester-App (Google) zum Messen von Round-Trip-Latenz und
Glitches. `getOutputLatencyMs()` liefert die geschätzte Ausgabe-Pufferlatenz des
aktiven Oboe-Streams.

## Lizenz

Oboe steht unter Apache 2.0 (siehe `LICENSE` im Oboe-Repo). Attribution im
About-/Impressum-Bereich der App erforderlich.