# DEVICE RUNTIME VERIFICATION RUNBOOK — VibeCore Univers (Stand: 2026-08-18)

**Zweck:** Physischer Android-Runtime-Test (Ziel: Xiaomi-Gerät) ohne weitere
Architekturarbeit. Vorbedingung dieses Runbooks ist erfüllt: Build ist real
verifiziert (BUILD SUCCESSFUL), APK vorhanden.

**Bekannte Bedingung:** Es ist ein **physisches Android-Gerät (USB-Debugging)
oder ein Emulator mit KVM** erforderlich. In der Repl-Umgebung ist beides
nicht verfügbar (`adb devices` leer, kein `/dev/kvm`) → Device Runtime bleibt
dort NOT DONE.

## Artefakt

| | |
|---|---|
| APK | `native-android/app/build/outputs/apk/debug/app-debug.apk` |
| Größe | 4 529 481 Bytes |
| SHA-256 | `3962ac2f68c3895307d6961e221293e4450cca4d9585e287c962854df4e98d89` (Rebuild 2026-08-18, funktionsgleich; Debug-Signatur macht jeden Build hash-verschieden) |
| Package | `com.vibecore.app` (versionCode 1) |
| ABIs | arm64-v8a (Xiaomi-Standard), armeabi-v7a, x86_64 |
| minSdk / target | 21 / 34 |
| Signatur | Debug-Keystore (Sideload ok; Play-Store nein) |

Log-Tags: Kotlin-Bridge `VibeCoreAudio`, natives Log `VibeCore`
(`__android_log_print`, VibeCoreLog.h). Alle Schritte ≤ 30 min (TP-001).

## Schritte (exakt in dieser Reihenfolge, Evidenz je Schritt sichern)

### 1. APK installieren
```bash
adb devices                      # Gerät muss "device" zeigen (nicht "unauthorized")
adb install -r app-debug.apk     # Erwartung: "Success"
```
Evidenz: Konsolenausgabe. Fehlerbild `INSTALL_FAILED_NO_MATCHING_ABIS` wäre
ein ABI-Problem (bei arm64-Xiaomi nicht erwartet).

### 2. App starten
```bash
adb logcat -c
adb shell am start -n com.vibecore.app/.MainActivity
adb logcat -d | grep -E "VibeCoreAudio|VibeCore|AndroidRuntime" > 01_launch.log
```
Erwartung: Activity startet, WebView lädt `file:///android_asset/webapp/index.html`,
kein `FATAL EXCEPTION`.

### 3. System.loadLibrary
Erfolgsfall ist **still** (kein Log). Fehlerfall:
`E/VibeCoreAudio: Failed to load vibecore-native: …` → dann STOP, Befund dokumentieren.
Gegenprobe aus Chrome DevTools (chrome://inspect → WebView):
```js
window.VibeCoreNative.isAvailable()   // Erwartung: true
```

### 4. Native Platform Init + 5. Oboe Init + 6. Stream Open/Start
```js
window.VibeCoreNative.startEngine()   // Erwartung: true
window.VibeCoreNative.isEngineRunning() // true
window.VibeCoreNative.getLatencyMs()  // Erwartung: > 0 (typisch 10–40 ms)
```
```bash
adb logcat -d | grep VibeCore > 02_engine.log   # openStream/AAudio-Zeilen sichern
```
Erwartung im Log: Stream open (AAudio, LowLatency), Samplerate/Burst-Angaben.

### 7. Audio Smoke Test (hörbar)
```js
window.VibeCoreNative.setMasterGain(0.8)
window.VibeCoreNative.grooveSetStep(0, 0, true)   // Step 1, Track 1 aktivieren
window.VibeCoreNative.setTempo(120)
window.VibeCoreNative.play()
```
Erwartung: hörbares, periodisches Signal ohne Knacken/Dropouts (~30 s hören).
XRun-Kontrolle: `adb logcat -d | grep -iE "xrun|underrun"` — Erwartung: leer/0.

### 8. Stop/Close + sauberes Shutdown
```js
window.VibeCoreNative.stop(); window.VibeCoreNative.stopEngine()
```
Dann App via Back/Recents beenden. Erwartung: Stille sofort, kein Crash beim
Beenden (`adb logcat -d | grep -E "FATAL|SIGSEGV"` leer). Zusatztest
Audiofokus: während Wiedergabe Musik-App starten → VibeCore muss stoppen
(Fokusverlust wird in MainActivity durchgesetzt; kein Auto-Resume).

### 9. WebView Bridge Smoke
```js
typeof window.VibeCoreNative           // "object"
typeof window.VibeCoreHost             // "object"
window.VibeCoreHost.hasMicrophonePermission()      // false (frisch installiert)
window.VibeCoreNative.getTempo()       // 120 nach Schritt 7
```
Hinweis (dokumentierter Befund, NICHT Teil dieses Gates): die Web-App nutzt
derzeit WebAudio; das TS-Interface hat Mismatches zur Kotlin-Bridge
(`start()` vs. `startEngine()`, `loadSample/trigger/configure` fehlen). Der
Bridge-Smoke erfolgt daher direkt über die DevTools-Konsole, nicht über die App-UI.

### 10. Logs/Evidenz sammeln
```bash
adb logcat -d > full_session.log
adb shell dumpsys media.audio_flinger | head -100 > audioflinger.txt   # optional
```
Abzugeben: 01_launch.log, 02_engine.log, full_session.log, Ton-Beobachtung
(gehört ja/nein, Artefakte ja/nein), ggf. Video/Audio-Mitschnitt.

## P1-Befunde — Relevanz für diesen Runtime-Test (keine Fixes in diesem Gate)
- **Bass numFrames-Clamp fehlt:** relevant, falls das Gerät Callbacks > 2048
  Frames liefert (möglich bei Nicht-LowLatency-Fallback). Beim Smoke-Test
  Log auf `numFrames` und Crashes beim 3D-Bass beobachten; Bass-Trigger im
  Smoke-Test optional weglassen.
- **Toter Mixer/Master-Gain-Graph-Pfad:** NICHT blockierend — `setMasterGain`
  wirkt über den Engine-seitigen Gain (Schritt 7 testet genau diesen Pfad).
- **SPSC-Queue-Vertrag:** NICHT blockierend — im WebView kommen alle
  Bridge-Aufrufe von einem einzigen JS-Thread (ein Producer, vertragskonform).

## Abbruchkriterien
Crash bei Launch/loadLibrary/startEngine → Test stoppen, full_session.log
sichern, Befund zurückmelden. Kein Fix am Gerät improvisieren.
