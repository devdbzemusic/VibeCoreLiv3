# VibeCoreLiv3 — Pure Android UI / Feature Parity Contract

Stand: 2026-09-16  
Branch: `revision/pure-android-compose`

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
| Scene / Pattern Banks | Web Scene/Pattern workflow | Native Scene/Pattern screen | REFERENCE | OPEN | OPEN | PARTIAL CORE | OPEN | OPEN | REFERENCE |
| Mixer | `MixTab` / `ChannelStrip` | `MixerScreen.kt` | REFERENCE | OPEN | OPEN | NATIVE CORE PARTIAL | OPEN | OPEN | REFERENCE |
| Sample Forge | `SmplTab.tsx` / `ForgeTab.tsx` | `SampleForgeScreen.kt` | REFERENCE | OPEN | OPEN | NATIVE ASSET CORE PARTIAL | OPEN | OPEN | REFERENCE |
| Synth 3D | `Synth3DPage.tsx` / subtabs | `Synth3DScreen.kt` | REFERENCE | OPEN | OPEN | NATIVE SYNTH GAP | OPEN | OPEN | REFERENCE |
| Bass 3D | `Bass3DPage.tsx` / subtabs | `Bass3DScreen.kt` | REFERENCE | OPEN | OPEN | NATIVE BASS CORE EXISTS | OPEN | OPEN | REFERENCE |
| Voice | `VoiceTab.tsx` | `VoiceScreen.kt` | REFERENCE | OPEN | OPEN | NATIVE VOICE CORE EXISTS | OPEN | OPEN | REFERENCE |
| FX / Sends | FX tabs / channel sends | `FxScreen.kt` / Mixer | REFERENCE | OPEN | OPEN | PARTIAL CORE | OPEN | OPEN | REFERENCE |
| Piano Roll | Web piano-roll controls | `PianoRollScreen.kt` | REFERENCE | OPEN | OPEN | NATIVE GROOVE API EXISTS | OPEN | OPEN | REFERENCE |
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

1. Pattern/Scene Vollparität + Persistenz
2. Mixer
3. Sample Forge + Android SAF + Native PCM Asset Store
4. Bass 3D
5. Voice
6. Synth 3D Native Renderer
7. FX / Sends
8. Piano Roll
9. Motion/Automation/Arp
10. Android MIDI
11. Settings/Diagnostics
12. AI Intent UI
13. vollständiger Parity-/Device-/Performance-Abschluss

React/Vite/Web-Code bleibt bis dahin ausschließlich als Golden Master im Repository erhalten und ist nicht die aktive Android Runtime.
