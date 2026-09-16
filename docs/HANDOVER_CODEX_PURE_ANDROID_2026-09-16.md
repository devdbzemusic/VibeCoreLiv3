# Handover — VibeCoreLiv3 Pure Android Compose Migration

Stand: 2026-09-16  
Branch: `revision/pure-android-compose`  
PR: #2 `Pure Android Compose migration — preserve VibeCore UI/feature parity`
Base: `revision/v4-runtime-consolidation`

## Auftrag

Nicht redesignen. Bestehendes VibeCore bleibt Golden Master für Look, Workflow und Featureumfang.

Aktiver Zielpfad:

```text
Jetpack Compose
→ VibeCoreViewModel / StateFlow
→ NativeRuntime.kt
→ NativeAudioBridge / NativeGrooveAssetBridge (direkte Kotlin-Aufrufe; kein WebView)
→ JNI
→ C++ / VibeCoreSync / GrooveEngine / Oboe
```

WebView/WebAudio dürfen im Pure-Android-Laufzeitpfad nicht wieder eingeführt werden.

## Remote bereits umgesetzt

- Compose im bestehenden Android/NDK/Oboe-Modul aktiviert
- `MainActivity` ist Compose Launcher, kein WebView Host mehr
- VibeCore Theme-Tokens aus `src/index.css` nach Compose übertragen
- `VibeCoreUiState`, `VibeCoreViewModel`, `NativeRuntime`
- direkte Kotlin→JNI Transport-/Groove-Steuerung
- Pattern: 16 Tracks / 16 Steps / Playhead / BPM / Play / Stop / Mute / Solo
- Mixer: 16 Track-Volumes + Mute/Solo
- native Persistenz des ersten Parity-Slices
- Persist-State wird beim Start in Native Groove hydriert
- TrackKind → Native TrackMode
- Android Audio Focus
- Android-native Audio-Decoding via `MediaExtractor` + `MediaCodec`
- Android SAF/OpenDocument Sample Picker
- downmix zu Mono-Float PCM
- direkter Native Groove cold-load über `NativeGrooveAssetBridge`
- Sample-ID = Track/Part-ID
- persistierbare Android Sample-URI + Name
- automatische PCM-Restaurierung beim App-Start
- `docs/PURE_ANDROID_UI_FEATURE_PARITY.md`

## Sofort lokal ausführen

```powershell
cd G:\Dev\VibeCoreLiv3
git fetch origin
git switch revision/pure-android-compose
git pull

cd native-android
.\gradlew.bat clean :app:assembleDebug
```

APK erwartet unter:

```text
native-android\app\build\outputs\apk\debug\app-debug.apk
```

Optional installieren:

```powershell
adb install -r .\app\build\outputs\apk\debug\app-debug.apk
```

## Compiler-first Regel

Keine Architektur neu erfinden. Compilerfehler in den neuen Compose-Dateien zuerst minimal beheben.

Statisch bereits aufgefallen / zuerst prüfen:

`native-android/app/src/main/java/com/vibecore/app/ui/VibeCoreApp.kt`

Im `MixerRow()` steht derzeit ein positionaler Material3-`Text(...)`-Aufruf:

```kotlin
Text(track.name, Modifier.width(72.dp), ..., 10.sp, FontWeight.Bold, maxLines = 1)
```

Je nach Compose-Text-Signatur wird `FontWeight.Bold` dort als `fontStyle` interpretiert und kann den Compile brechen. Minimal auf named arguments umstellen:

```kotlin
Text(
    text = track.name,
    modifier = Modifier.width(72.dp),
    color = if (selected) VibeCoreColors.PrimaryGlow else VibeCoreColors.Foreground,
    fontSize = 10.sp,
    fontWeight = FontWeight.Bold,
    maxLines = 1,
)
```

Danach alle weiteren Compilerfehler einzeln und minimal beheben; keine Feature-Entfernung als Build-Fix.

## Device Test 1 — Boot

Erwartung:

- App öffnet direkt Compose
- kein WebView
- Header zeigt `PURE ANDROID • OBOE`, wenn Native Library geladen
- kein Crash durch JNI/Compose
- Transport zunächst idle

## Device Test 2 — Pattern

1. Kick auswählen.
2. Steps 1/5/9/13 aktivieren.
3. BPM ändern.
4. Play.
5. Playhead muss sichtbar laufen.
6. Stop.
7. App vollständig schließen und neu öffnen.
8. Steps + BPM müssen wiederhergestellt sein.

Hinweis: Ein Drum-Track benötigt ein tatsächlich geladenes Sample, um hörbar zu sein.

## Device Test 3 — Mixer

- Volume auf mehreren Tracks ändern.
- Mute/Solo testen.
- App neustarten.
- Werte müssen erhalten bleiben.
- Native Groove muss die Werte beim Start wieder erhalten.

## Device Test 4 — Sample

1. SAMPLE Tab öffnen.
2. KICK/SNARE/PERC/HAT oder SAMPLE 1..10 wählen.
3. `CHOOSE AUDIO`.
4. WAV/MP3/AAC wählen.
5. Android Decoder muss PCM liefern.
6. Oboe Stream wird für Cold-Load gestoppt.
7. PCM wird Native geladen.
8. Track erhält `sampleId == track.id`.
9. Pattern Step setzen und Play.
10. Sample muss hörbar sein.
11. App neu starten.
12. Persisted URI muss Sample erneut laden.

Bei Provider ohne persistierbare URI-Permission darf die App nicht lügen: Status soll Restore-Fehler sichtbar machen / Datei erneut auswählen lassen.

## Audio-/Timing-Regeln

- kein `Handler`/Coroutine/Compose Timer als Sequencer
- 33-ms Poll in ViewModel ist ausschließlich UI-Playhead/Diagnostics
- musikalischer Scheduler bleibt `VibeCoreSync` C++
- Oboe bleibt alleinige Audio Authority
- keine WebAudio-Fallbacks

## Noch nicht als fertig behandeln

- Scene/Pattern Banks
- komplette Sample Forge Waveform/Edit/Slices
- Bass3D UI-Parität
- Voice UI-Parität
- Native Synth3D Renderer
- FX/Sends
- Piano Roll
- Motion/Automation
- Arp
- Android MIDI
- Settings
- AI UI
- vollständiges v13 Project Schema statt temporärer Slice-Persistenz

## Reihenfolge nach erstem grünen Build

1. Compiler + Boot + Pattern/Mixer/Sample E2E grün machen.
2. Visuellen Vergleich gegen Golden Master durchführen; Layout/Spacing/Farben korrigieren, ohne Workflow zu ändern.
3. Scene/Pattern Banks + vollständige native Projektpersistenz.
4. Voice Compose (Native Voice Core existiert bereits).
5. Bass3D Compose (Native Bass Core existiert bereits).
6. Sample Forge Waveform/Edit/Slice vollständig.
7. Native Synth3D Renderer + Compose.
8. FX/PianoRoll/Motion/Arp/MIDI/Settings/AI.

## Abnahme

Kein Screen erhält `VERIFIED`, bevor Look + Input + State + Audio + Persist + E2E auf echtem Android-Gerät geprüft wurden.

Nicht nach `main` mergen, solange PR #2 Draft ist und diese Gates offen sind.
