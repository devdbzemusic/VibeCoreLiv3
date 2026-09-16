# VibeCoreLiv3 — Pure Android UI / Feature Parity Contract

Stand: 2026-09-16  
Branch: `revision/pure-android-compose`

## Aktueller Verifikationsstand

Sprint 1 (`Pure Android Build & Runtime Bootstrap`) ist lokal `BUILD VERIFIED`:

- JDK 17 aktiv fuer Gradle.
- `native-android :app:assembleDebug` erfolgreich.
- APK erzeugt unter `native-android/app/build/outputs/apk/debug/app-debug.apk`.
- Compose-Kotlin-Blocker in `VibeCoreApp.kt` minimal behoben.

Noch offen: `DEVICE VERIFIED`, `PARITY VERIFIED`, Live-Audio-/Sample-Abnahme und vollstaendige E2E-Matrix auf echtem Android-Geraet.

Sprint 2 (`Device Runtime & First E2E`) ist fuer den ersten Runtime-Slice `DEVICE VERIFIED`:

- Compose-Shell bootet auf Geraet `RZCY91QYC9N`.
- Kein weisser Screen / keine aktive WebView-Oberflaeche im Launcher.
- Native `VibeCoreAudioEngine` und `GrooveNode` initialisieren.
- Oboe/AAudio laeuft mit 48 kHz.
- Transport Start/Stop ist per Logcat nachgewiesen.
- Mixer-Screen ist erreichbar.

Nicht enthalten: Sample-Playback, vollstaendige Persistenzrunde, Bass/Voice/Synth/FX/AI-Parity.

Sprint 3 (`Pattern/Mixer Persistenz & Restart-E2E`) ist fuer den ersten Pattern-/Mixer-Slice `DEVICE VERIFIED`:

- Snare-Track-Auswahl persistiert ueber Force-Stop/Relaunch.
- Snare Steps `01` und `09` persistieren ueber Force-Stop/Relaunch.
- Mixer Kick-Volume `46` persistiert ueber Force-Stop/Relaunch.
- Mixer bleibt nach Relaunch erreichbar und touch-/scroll-bedienbar.

Weiterhin offen: Sample-Datei-Import, Sample-Playback, Sample-Restore und vollstaendige Screen-Parity.

Sprint 5 (`Landscape UX Fit`) ist fuer Pattern im Querformat `DEVICE VERIFIED`:

- Landscape wird in Compose erkannt und kompakt gerendert.
- Transport, Trackstrip und Pattern-Panel passen in den ersten Querformat-Viewport.
- Alle 16 Pattern-Steps sind im Landscape-Startzustand sichtbar.
- Pattern bleibt touch-bedienbar und visuell im VibeCore-Stil.

Sprint 6 (`Landscape Mixer/Sample Fit`) ist fuer Mixer und Sample im Querformat `DEVICE VERIFIED`:

- Mixer zeigt im Landscape-Startviewport mehrere direkt bedienbare Kanalreihen.
- Sample Forge zeigt Track-Auswahl, Status und `CHOOSE AUDIO` im ersten Landscape-Viewport.
- Beide Screens bleiben im VibeCore-Stil und ohne aktive WebView/WebAudio-Oberflaeche.

Sprint 7 (`Sample Import Failure Handling`) ist fuer den Android-SAF-Abbruchpfad `DEVICE VERIFIED`:

- `CHOOSE AUDIO` startet den Android-Dateipicker sichtbar.
- Picker-Abbruch per Back wird im Sample-Status sichtbar gemeldet.
- Decode-/Native-Load-Fehler werden mit Stacktrace in Logcat geschrieben.
- Persisted-Sample-Restore meldet Teilfehler sichtbar und fordert Re-Select statt stummem Erfolg.

Weiterhin offen: vollautomatischer SAF-Dateiauswahl-Nachweis, hoerbarer Sample-Playback-E2E und Sample-Restore mit echter persistierter URI.

Sprint 8 (`Bass/Synth Performance Keyboard`) ist fuer den Native-Bass-Keyboard-Slice `DEVICE VERIFIED`:

- `BASS` ist als eigener Compose-Screen in der unteren Navigation erreichbar.
- 3D Bass zeigt im Landscape-Viewport eine 12-Tasten-Tastatur plus `ALL OFF`, aktive Note, Voice- und Level-Meter.
- Bass-Note-On/Off laeuft ueber Kotlin/JNI in den Native `BassEngine`/`BassNode` und startet den Oboe/AAudio-Stream.
- Logcat bestaetigt `BassNode: prepared` und `Engine running` nach Keyboard-Tap.
- 3D Synth zeigt die Keyboard-Oberflaeche, bleibt aber explizit `NATIVE SYNTH GAP`; kein WebAudio-/WebView-Fallback.

Weiterhin offen: vollstaendige Bass3D-Parameter-/Deep-Editor-Paritaet, hoerbarer Audio-Abgleich und dedizierter Native Synth3D Renderer.

Sprint 9 (`Scene / Piano-Roll Native Entry`) ist fuer die ersten Scene- und Piano-Roll-Eingriffe `DEVICE VERIFIED`:

- `SCENE` ist als eigener Compose-Screen erreichbar.
- 8 Scene-Pads queueen Scene-Wechsel ueber Native Groove.
- Aktive und pending Scene werden angezeigt.
- `ROLL` ist als eigener Compose-Screen erreichbar.
- Bass/Synth-Tracks koennen ausgewaehlt werden.
- Note-Pads schreiben ueber `grooveAddPianoRollNote()` direkt in den Native-Groove-Piano-Roll.
- `CLEAR` ruft `grooveClearPianoRoll()` auf.

Weiterhin offen: Scene-Bank-/Chain-Paritaet, vollstaendiger Piano-Roll-Editor, Persistenz und hoerbarer Transport-E2E fuer Piano-Roll-Noten.

## Ziel

Die Pure-Android-Migration ist **kein Redesign**.

> Wir tauschen den Motor, nicht das Auto.

Der bestehende VibeCore-Webstand bleibt während der Migration Golden Master für Look, Informationsarchitektur, Bedienwege und Featureumfang. Jetpack Compose ersetzt React/WebView als Präsentationsschicht; Kotlin ersetzt Browser-State/Browser-APIs; C++/Oboe/VibeCoreSync bleiben Audio- und Timing-Authority.

## Harte Regeln

1. Kein Feature wird nur wegen der Native-Migration entfernt.
2. Kein Compose-Screen gilt als migriert, solange Look oder Funktionsumfang wesentlich vom Golden Master abweichen.
3. Kein WebAudio-/WebView-Fallback im aktiven Pure-Android-Runtime-Pfad.
4. Musikalisches Timing bleibt C++/VibeCoreSync; Compose/Kotlin dürfen keinen zweiten Sequencer/Scheduler bilden.
5. UI-Polling darf ausschließlich Anzeige/Diagnose betreiben.
6. Ein alter Web-Screen wird erst aus der Referenz entfernt, wenn sein Native-Gegenstück lokal geprüft wurde.
7. Native Runtime und persistierter Projektzustand dürfen nicht als zwei konkurrierende Projektwahrheiten geführt werden.

## Visuelle Golden-Master-Tokens

Aus `src/index.css` übernommen:

- Deep-space navy background/surfaces
- Neon cyan primary
- Violet / Magenta / Lime / Amber / Crimson performance colors
- rounded panel language (~16 px)
- cyan border/glow emphasis
- dark panel gradients
- compact mono diagnostics / BPM readouts
- Part colors: Kick Crimson, Snare Amber, Perc Yellow, Hat Lime, Bass Cyan, Synth Violet, Sample Magenta

Compose-Übersetzung: `native-android/app/src/main/java/com/vibecore/app/ui/VibeCoreTheme.kt`

## Parity Matrix

Statuswerte:

- `REFERENCE` — Web-Golden-Master vorhanden, Native noch nicht begonnen
- `SHELL` — Native Layout/Navigation vorhanden, Funktion noch unvollständig
- `WIRED` — Native Runtime/State angeschlossen, lokale Prüfung offen
- `VERIFIED` — lokal auf Android geprüft

| Bereich | Golden Master | Native Ziel | Look | Input | State | Audio | Persist | E2E | Status |
|---|---|---|---|---|---|---|---|---|---|
| App Shell | `Index.tsx` + globale Groovebox-Struktur | `VibeCoreApp.kt` | SHELL | SHELL | SHELL | n/a | OPEN | OPEN | SHELL |
| Top Transport | `TopBar.tsx` | Compose TransportPanel | SHELL | WIRED | WIRED | WIRED | OPEN | OPEN | WIRED |
| Track Selector | Groovebox part strip | Compose TrackStrip | SHELL | WIRED | WIRED | n/a | OPEN | OPEN | WIRED |
| 16-Step Pattern | Pattern/Performance views | Compose PatternPanel | SHELL | WIRED | WIRED | WIRED | OPEN | OPEN | WIRED |
| Mute / Solo | Channel/Pattern controls | Compose PatternPanel | SHELL | WIRED | WIRED | WIRED | OPEN | OPEN | WIRED |
| Scene / Pattern Banks | Web Scene/Pattern workflow | Native Scene/Pattern screen | SHELL | WIRED SCENE QUEUE | PARTIAL | PARTIAL CORE | OPEN | PARTIAL | DEVICE VERIFIED SLICE |
| Mixer | `MixTab` / `ChannelStrip` | `MixerScreen.kt` | REFERENCE | OPEN | OPEN | NATIVE CORE PARTIAL | OPEN | OPEN | REFERENCE |
| Sample Forge | `SmplTab.tsx` / `ForgeTab.tsx` | `SampleForgeScreen.kt` | SHELL | WIRED | WIRED | NATIVE ASSET CORE PARTIAL | PARTIAL | PARTIAL | WIRED |
| Synth 3D | `Synth3DPage.tsx` / subtabs | `Synth3DScreen.kt` | SHELL | WIRED KEYBOARD UI | PARTIAL | NATIVE SYNTH GAP | OPEN | PARTIAL | GAP VISIBLE |
| Bass 3D | `Bass3DPage.tsx` / subtabs | `Bass3DScreen.kt` | SHELL | WIRED KEYBOARD | PARTIAL | WIRED BASS KEYBOARD | OPEN | PARTIAL | DEVICE VERIFIED SLICE |
| Voice | `VoiceTab.tsx` | `VoiceScreen.kt` | REFERENCE | OPEN | OPEN | NATIVE VOICE CORE EXISTS | OPEN | OPEN | REFERENCE |
| FX / Sends | FX tabs / channel sends | `FxScreen.kt` / Mixer | REFERENCE | OPEN | OPEN | PARTIAL CORE | OPEN | OPEN | REFERENCE |
| Piano Roll | Web piano-roll controls | `PianoRollScreen.kt` | SHELL | WIRED ADD/CLEAR | PARTIAL | NATIVE GROOVE API WIRED | OPEN | PARTIAL | DEVICE VERIFIED SLICE |
| Automation / Motion | `AutomationDrawer.tsx` etc. | Native Automation/Motion | REFERENCE | OPEN | OPEN | OPEN | OPEN | OPEN | REFERENCE |
| Arp | `ArpPanel.tsx` | Native Arp controls | REFERENCE | OPEN | OPEN | CONTRACT OPEN | OPEN | OPEN | REFERENCE |
| MIDI | Browser MIDI path | Android MIDI API → Native | REFERENCE | OPEN | OPEN | OPEN | OPEN | OPEN | REFERENCE |
| Diagnostics | `DiagPanel` / DiagnosticsModal | Native Diagnostics | REFERENCE | OPEN | WIRED CORE | WIRED CORE | n/a | OPEN | SHELL |
| AI | AI Context / Scene / CoAssistant | Native intent UI | REFERENCE | OPEN | CORE PARTIAL | n/a | OPEN | OPEN | REFERENCE |
| Settings | Web settings/setup | Native Settings | REFERENCE | OPEN | OPEN | OPEN | OPEN | OPEN | REFERENCE |

## Aktiver Pure-Android Runtime-Pfad

```text
MainActivity (ComponentActivity)
→ Jetpack Compose
→ VibeCoreViewModel / StateFlow
→ NativeRuntime.kt
→ NativeAudioBridge Kotlin methods (direct call, no WebView dispatch)
→ JNI
→ C++ VibeCoreAudioEngine / GrooveEngine / BassEngine / VoiceEngine
→ Oboe
```

`NativeAudioBridge` behält vorerst seinen historischen Klassennamen/JNI-Symbolvertrag. Im Pure-Android-Pfad wird es direkt von Kotlin benutzt; `WebView.addJavascriptInterface` ist nicht beteiligt.

## Aktueller erster Slice

Bereits im Branch:

- Compose im Android-Modul aktiviert
- WebView aus `MainActivity` entfernt
- Pure Compose Launcher aktiv
- VibeCore Theme-Tokens übertragen
- Native `StateFlow` UI state
- direkter Kotlin→JNI Runtime Adapter
- Transport Play/Stop
- BPM +/-
- 16 Step Toggle
- Track-Auswahl
- Mute/Solo
- Native Playhead-Anzeige (UI polling only)
- Native status / latency display
- Android Audio Focus

## Definition of migrated screen

Ein Screen darf erst `VERIFIED` erhalten, wenn:

- visuell gegen Golden Master geprüft
- alle sichtbaren Eingaben funktionieren
- Projektzustand round-trip/persistiert
- relevante Native Audio-/MIDI-Auswirkung geprüft
- Rotation/Lifecycle geklärt
- kein WebView/WebAudio nötig
- kein zweiter musikalischer Scheduler entstanden
- E2E auf echtem Android-Gerät durchgeführt

## Nächste Reihenfolge

1. Pattern/Scene Restparitaet + Persistenz
2. Mixer
3. Sample Forge + Android SAF + Native PCM Asset Store
4. Bass 3D Restparitaet
5. Voice
6. Synth 3D Native Renderer
7. FX / Sends
8. Piano Roll Resteditor
9. Motion/Automation/Arp
10. Android MIDI
11. Settings/Diagnostics
12. AI Intent UI
13. vollständiger Parity-/Device-/Performance-Abschluss

React/Vite/Web-Code bleibt bis dahin ausschließlich als Golden Master im Repository erhalten und ist nicht die aktive Android Runtime.
