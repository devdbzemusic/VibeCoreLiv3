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

## Sprint 1 lokaler Build-Status

Status: `BUILD VERIFIED`

Am 2026-09-16 wurde der lokale Pure-Android-Debug-Build auf Branch
`revision/pure-android-compose` mit JDK 17 erfolgreich gebaut:

```powershell
$env:JAVA_HOME="C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot"
.\gradlew.bat :app:assembleDebug
```

Ergebnis:

```text
BUILD SUCCESSFUL
APK: native-android\app\build\outputs\apk\debug\app-debug.apk
```

Gefixter Build-Blocker:

- `VibeCoreApp.kt`: fehlerhaften Compose-`weight`-Import entfernt.
- `VibeCoreApp.kt`: positionalen `Text(...)`-Aufruf im Mixer auf benannte Parameter umgestellt.

Noch nicht behaupten: `DEVICE VERIFIED`, `PARITY VERIFIED` oder hörbare Sample-/Transport-Abnahme.

## Sprint 2 Device-Runtime-Status

Status: `DEVICE VERIFIED` fuer Boot, Compose-Shell und Transport-Start/Stop-Slice.

Device:

```text
RZCY91QYC9N
```

Evidence:

```text
evidence\2026-09-16_11-30-42-pure-android-sprint2-rerun\
```

Geprueft:

- APK per `adb install -r` installiert.
- App startet als `com.vibecore.app/.MainActivity`.
- Kein weisser Screen, keine aktive WebView-Oberflaeche sichtbar.
- Header zeigt `PURE ANDROID • OBOE`.
- Native Core initialisiert `VibeCoreAudioEngine` und `GrooveNode`.
- Oboe/AAudio startet mit 48 kHz und Exclusive Stream.
- Transport `PLAY` erzeugt `GrooveNode: transport start`.
- Transport `STOP` erzeugt `GrooveNode: transport stop`.
- UI unterscheidet jetzt Transport und Engine-Warmstatus:
  - `TRANSPORT PLAYING` waehrend Playback.
  - `ENGINE READY` nach Stop bei weiterhin warmem Audio-Stream.
- Mixer-Screen ist erreichbar und zeigt native 16-Part-Level-UI.

Offen:

- Sample-Import/Playback mit realer WAV/MP3/AAC-Datei.
- Persistenz-E2E nach vollstaendigem App-Neustart fuer Pattern/Mixer/Sample.
- Vollstaendige Parity-Matrix fuer alle Screens.
- Hoerbare musikalische Abnahme mit geladenem Sample.

## Sprint 3 Pattern-/Mixer-Persistenz

Status: `DEVICE VERIFIED` fuer Pattern- und Mixer-Slice.

Evidence:

```text
evidence\2026-09-16_11-33-43-pure-android-sprint3-persistence\
```

Geprueft:

- Pattern-State gesetzt und nach `am force-stop` + Relaunch wiederhergestellt.
- Snare blieb als ausgewaehlter Track erhalten.
- Snare Steps `01` und `09` blieben aktiv.
- Mixer-State gesetzt und nach Relaunch wiederhergestellt.
- Kick Volume blieb bei `46`.
- Mixer-Screen blieb erreichbar und scroll-/touch-bedienbar.
- Keine App-Fatal-/ANR-/JNI-Crash-Zeilen im Logcat.

Hinweis:

- Der Test nutzte wegen bereits persistierter Track-Auswahl den Snare-Track, nicht Kick.
- Sample-Persistenz ist weiterhin offen, bis eine reale Audiodatei ueber den Android-Dateipicker geladen wurde.

## Sprint 4 Landscape Default

Status: `DEVICE VERIFIED` fuer App-Start im Querformat.

Evidence:

```text
evidence\2026-09-16_11-36-16-landscape-default\
```

Geaendert:

- `MainActivity` startet standardmaessig mit `android:screenOrientation="landscape"`.

Geprueft:

- Debug-APK erfolgreich gebaut.
- APK auf `RZCY91QYC9N` installiert.
- App startet fokussiert als `com.vibecore.app/.MainActivity`.
- WindowManager meldet `SCREEN_ORIENTATION_LANDSCAPE`.
- Screenshot zeigt VibeCore Compose UI im Querformat.
- Kein Fatal/ANR/SIGSEGV/SIGABRT/UnsatisfiedLinkError im frischen Logcat.

## Sprint 5 Landscape UX Fit

Status: `DEVICE VERIFIED` fuer Pattern-Landscape-Fit.

Evidence:

```text
evidence\2026-09-16_11-40-58-landscape-ux-fit-final\
```

Geaendert:

- Compose-Shell erkennt Landscape ueber `BoxWithConstraints`.
- Transport-Bar nutzt im Landscape-Modus kompaktere Abstaende und Schriftgroessen.
- Trackstrip nutzt im Landscape-Modus breitere, niedrigere Touch-Ziele.
- Pattern-Screen nutzt im Landscape-Modus eine 2x8-Step-Matrix neben Trackkopf und Mute/Solo.
- Step-Zahlen und Toggle-Chips sind fuer die kompakte Darstellung typografisch stabilisiert.

Geprueft:

- Debug-APK erfolgreich gebaut.
- APK auf `RZCY91QYC9N` installiert.
- App startet im Querformat.
- Alle 16 Pattern-Steps sind im ersten Landscape-Viewport sichtbar.
- App bleibt fokussiert als `com.vibecore.app/.MainActivity`.
- Kein Fatal/ANR/SIGSEGV/SIGABRT/UnsatisfiedLinkError im frischen Logcat.

## Sprint 6 Landscape Mixer/Sample Fit

Status: `DEVICE VERIFIED` fuer Mixer- und Sample-Landscape-Fit.

Evidence:

```text
evidence\2026-09-16_11-49-16-landscape-mixer-sample-fit-final2\
evidence\2026-09-16_11-53-08-landscape-sample-name-final\
```

Geaendert:

- Mixer nutzt im Landscape-Modus kompaktere Kopfzeile und dichtere Kanalzeilen.
- Mixer zeigt im ersten Landscape-Viewport mehrere direkt bedienbare Kanalreihen.
- Sample Forge nutzt im Landscape-Modus eine zweispaltige Ansicht.
- Sample-Track-Auswahl bleibt horizontal bedienbar.
- Sample-Asset-Karte zeigt Status und `CHOOSE AUDIO` direkt im ersten Landscape-Viewport.
- Sample-Button-Breite wurde begrenzt, damit Statusbereich und Aktion nicht gegenseitig verdrängen.

Geprueft:

- Debug-APK erfolgreich gebaut.
- APK auf `RZCY91QYC9N` installiert.
- Mixer- und Sample-Screen im Querformat sichtbar und fokussiert.
- App bleibt fokussiert als `com.vibecore.app/.MainActivity`.
- WindowManager meldet `SCREEN_ORIENTATION_LANDSCAPE`.
- Kein Fatal/ANR/SIGSEGV/SIGABRT/UnsatisfiedLinkError im frischen Logcat.

Optional installieren:

```powershell
adb install -r .\app\build\outputs\apk\debug\app-debug.apk
```

## Sprint 7 Sample Import Failure Handling

Status: `DEVICE VERIFIED` fuer den Android-SAF-Abbruchpfad, `PARTIAL` fuer vollstaendiges Sample-Playback-E2E.

Evidence:

```text
evidence\20260916-124006-sample-playback\
```

Simulation / Befund:

- Sample Forge ist im Querformat erreichbar.
- `CHOOSE AUDIO` startet den Android-Dateipicker.
- Ein kurzer Test-WAV wurde nach `/sdcard/Download/VibeCoreTestKick.wav` gepusht, damit kuenftige SAF-Tests nicht von langen Songs abhaengen.
- Automatisierte Dateiauswahl im externen DocumentsUI-Picker war instabil; der Picker kehrte ohne Dateizuweisung in die App zurueck.
- Vor der Revision blieb der Picker-Abbruch fuer den User stumm sichtbar.

Failure/Error Handling Revision Todo:

- DONE: Picker-Start als sichtbaren UI-Status melden.
- DONE: Picker-Abbruch als sichtbaren UI-Status melden.

## Sprint 8 Bass/Synth Performance Keyboard

Status: `DEVICE VERIFIED` fuer den Native-Bass-Keyboard-Slice, `GAP VISIBLE` fuer Synth3D.

Geaendert:

- Untere Navigation enthaelt jetzt `BASS` als eigenen Native-Screen.
- 3D Bass zeigt eine touch-faehige 12-Tasten-Performance-Tastatur im Landscape-Viewport.
- Bass-Tasten rufen direkt `BassEngine noteOn/noteOff -> Oboe` ueber Kotlin/JNI/C++ auf.
- Bass wird vor Engine-Start vorbereitet, damit der `BassNode` im AudioGraph vorhanden ist.
- `ALL OFF`, aktive Note, aktive Bass-Voices und Output-Level sind sichtbar.
- 3D Synth zeigt dieselbe Keyboard-Oberflaeche, aber bewusst nur mit Gap-Status: kein WebAudio-Fallback, kein falscher Native-Synth-Claim.

Geprueft:

- Debug-APK erfolgreich gebaut.
- APK auf `RZCY91QYC9N` installiert.
- App startet im Querformat als `com.vibecore.app/.MainActivity`.
- `BASS`-Screen zeigt Header `3D BASS`, `ALL OFF`, `VOICES`, `LEVEL`, `ACTIVE` und alle 12 Keyboard-Tasten.
- Tap auf `C3` erzeugt sichtbaren Status `Bass note 60 released.`.
- Logcat zeigt Native-Engine-Start, `GrooveNode`, `BassNode`, AAudio/Oboe Exclusive Stream mit 48 kHz.
- `SYNTH`-Screen zeigt Keyboard-Tasten und die Meldung `native Synth3D renderer is still an open sprint`.
- Kein Fatal/ANR/SIGSEGV/SIGABRT/UnsatisfiedLinkError im gefilterten App-Logcat.

Offen:

- Hoerbarer Bass-Audio-Abgleich per Mess-/Audio-Protokoll statt nur Device/UI/Logcat-Nachweis.
- Vollstaendige Bass3D-Paritaet: Parameter, Mod Matrix, AI Bassline, Piano-Roll-Access, Deep Editor.
- Native Synth3D Renderer/JNI/Compose-Paritaet.

## Sprint 9 Scene / Piano-Roll Native Entry

Status: `DEVICE VERIFIED` fuer Scene-Queue- und Piano-Roll-Entry-Slices.

Geaendert:

- Untere Navigation enthaelt jetzt `SCENE` und `ROLL`.
- Scene-Screen zeigt 8 Scene-Pads, aktive Scene, Pending-Scene und sichtbaren Queue-Status.
- Scene-Pads rufen direkt `grooveQueueSceneChange()` ueber Kotlin/JNI/C++ auf.
- Piano-Roll-Screen zeigt Bass/Synth-faehige Tracks, Note-Pads und `CLEAR`.
- Note-Pads rufen direkt `grooveAddPianoRollNote()` auf; `CLEAR` ruft `grooveClearPianoRoll()` auf.
- Compose erzeugt keinen eigenen Sequencer; Tick-Positionen werden nur als Native-Groove-Daten geschrieben.

Geprueft:

- Debug-APK erfolgreich gebaut.
- APK auf `RZCY91QYC9N` installiert.
- `SCENE`-Screen zeigt `SCENES`, `BAR-SYNCED NATIVE GROOVE QUEUE`, `ACTIVE`, `PENDING` und 8 Scene-Pads.
- Tap auf Scene 03 erzeugt sichtbaren Status `Scene 3 queued through Native Groove.`.
- `ROLL`-Screen zeigt `PIANO ROLL`, Bass/Synth-Auswahl, Note-Pads und `CLEAR`.
- Tap auf `G2` erzeugt sichtbaren Status `Added note 55 to SYNTH at native tick 0. | notes 1`.
- Kein Fatal/ANR/SIGSEGV/SIGABRT/UnsatisfiedLinkError im gefilterten App-Logcat.

Offen:

- Vollstaendige Scene-Bank-/Scene-Chain-Paritaet inklusive Persistenz.
- Vollstaendiger Piano-Roll-Editor: Notenliste, Laengen, Velocity, Verschieben/Loeschen einzelner Noten, Persistenz.
- Hoerbarer E2E-Nachweis fuer Piano-Roll-Trigger ueber Transport mit passenden Instrument-/Sample-Zielen.

## Sprint 10 Voice Native Keyboard Entry

Status: `DEVICE VERIFIED` fuer den Native-Voice-Keyboard-/Node-Slice.

Geaendert:

- `VOICE` ist nicht mehr nur Placeholder, sondern zeigt eine Native-Voice-Performance-Oberflaeche.
- Voice wird vor Engine-Start vorbereitet, damit `VoiceNode` im AudioGraph vorhanden ist.
- Voice-Tasten rufen direkt `VoiceEngine noteOn/noteOff -> VoiceNode -> Oboe` ueber Kotlin/JNI/C++ auf.
- `ALL OFF`, aktive Note, aktive Voice-Units und Output-Level sind sichtbar.
- Status markiert ehrlich, dass Sample-Slots, Recording, Live-Input und AI-Voice-Paritaet noch offen sind.

Geprueft:

- Debug-APK erfolgreich gebaut.
- APK auf `RZCY91QYC9N` installiert.
- `VOICE`-Screen zeigt `VOICE`, `Native Voice keyboard -> VoiceEngine noteOn/noteOff -> Oboe`, `ALL OFF`, `VOICES`, `LEVEL`, `ACTIVE` und Keyboard-Tasten.
- Tap auf `C3` erzeugt sichtbaren Status `Voice note 60 released; sample/live-input content still needs parity work.`
- Logcat zeigt `AudioGraph: addNode id=3 name=VoiceNode`, `VoiceNode: prepared` und `Engine running`.
- Kein Fatal/ANR/SIGSEGV/SIGABRT/UnsatisfiedLinkError im gefilterten App-Logcat.

Offen:

- Voice-Sample-Slot Laden/Preview in Compose.
- Recording/Live-Input mit Android-Microphone-Permission.
- Pitch/Formant/Harmony/Layer/Phrase-Controls und AI-Workflow.
- Hoerbarer Voice-Audio-Abgleich mit geladenem Sample oder Live-Input.

## Sprint 11 Settings / Diagnostics Entry

Status: `DEVICE VERIFIED` fuer Native-Settings-/Diagnostics-Slice.

Geaendert:

- Untere Navigation enthaelt jetzt `SETTINGS`.
- Settings-Screen zeigt Native-Engine-Diagnosewerte: BPM, Engine-State, Play-State, Latenz, Runtime-Pfad und native Diagnosezeile.
- Master-Gain ist als Touch-Slider verfuegbar und schreibt direkt nach `VibeCoreAudioEngine::setMasterGain`.
- Master-Gain wird im aktuellen Compose-Persistenzschema gespeichert und beim Start wieder in Native Runtime hydriert.

Geprueft:

- Debug-APK erfolgreich gebaut.
- APK auf `RZCY91QYC9N` installiert.
- `SETTINGS`-Screen zeigt `SETTINGS`, `NATIVE ENGINE CONTROL + DIAGNOSTICS`, `MASTER`, `BPM`, `ENGINE`, `PLAY`, `LATENCY`, `PATH`, `OBOE`.
- Touch-Slider setzt Master-Gain sichtbar auf `MASTER 40%`.
- Kein Fatal/ANR/SIGSEGV/SIGABRT/UnsatisfiedLinkError im gefilterten App-Logcat.

Offen:

- Vollstaendige Settings-Paritaet gegen Golden Master.
- Exportierbarer Diagnosebericht statt nur kompakter Statuszeile.
- Weitere Engine-/Projektoptionen: Audio-Device-Auswahl, MIDI, Reset/Import/Export, Privacy/AI-Schalter.
- DONE: Decode-/Native-Load-Fehler mit Stacktrace in Logcat schreiben.
- DONE: Persisted-Sample-Restore-Teilfehler sichtbar machen statt stumm zu schlucken.
- DONE: Bass Macro Controls fuer Volume/Cutoff/Resonance/Glide/Waveform direkt an Native Bass/Oboe angeschlossen.
- DONE: Voice Macro Controls fuer Volume/DryWet/Pitch/Formant/Glide direkt an Native Voice/Oboe angeschlossen.
- OPEN: Vollautomatische SAF-Dateiauswahl robust machen oder als manuellen Device-Testschritt behandeln.
- OPEN: Hoerbares Sample-Playback-E2E mit echter Datei abschliessen.
- OPEN: Persisted-Sample-URI-Restore mit echter Dateiauswahl ueber Force-Stop/Relaunch nachweisen.
- OPEN: Bass3D Deep-Editor, Mod-Matrix und Klangvergleich gegen Golden Master abschliessen.
- OPEN: Voice Sample-Slots, Recording/Permission, Live-Input, Takes und AI-Voice-Aktionen abschliessen.

Geaendert:

- `VibeCoreViewModel.beginSamplePick()` prueft Tracktyp/Busy-State und setzt Picker-Startstatus.
- `VibeCoreViewModel.cancelSamplePick()` setzt den sichtbaren Abbruchstatus.
- `VibeCoreApp.kt` behandelt `OpenDocument()`-Rueckgabe `null` explizit.
- Sample-Load- und Restore-Fehler werden in Logcat unter `VibeCoreNativeUi` protokolliert.

Geprueft:

- Debug-APK erfolgreich gebaut.
- APK auf `RZCY91QYC9N` installiert.
- Sample-Tab geoeffnet, `CHOOSE AUDIO` gestartet, Picker per Back abgebrochen.
- UI zeigt danach `Audio selection cancelled. No sample was changed.`
- Transport bleibt idle, App bleibt fokussiert als `com.vibecore.app/.MainActivity`.

## Sprint 12 — Bass Macro Controls

Commit-Ziel:

- Native Bass nicht nur per Keyboard anspielbar machen, sondern erste echte Klangparameter in Compose bedienen.

Geaendert:

- `VibeCoreUiState` speichert Bass Volume, Cutoff, Resonance, Glide und Waveform.
- `NativeProjectRepository` persistiert diese Bass-Parameter mit Schema `5`.
- `NativeRuntime` bietet direkte `setBass*`-Methoden und bereitet den Bass Core nur einmal vor, damit Note-On keine Sliderwerte ueberschreibt.
- `VibeCoreViewModel` hydriert Bass-Parameter beim Start und schreibt jede UI-Aenderung direkt in Native Bass.
- `VibeCoreApp.kt` zeigt im Bass-Screen eine scrollbare Macro-Control-Spalte mit Waveform-Toggles und Slidern.

Geprueft:

- `native-android :app:assembleDebug` erfolgreich.
- APK auf `RZCY91QYC9N` installiert und gestartet.
- `BASS` geoeffnet; Keyboard und scrollbare Macro-Control-Spalte sichtbar.
- Control-Spalte gescrollt; `SAW/SQR/SUB/FM`, `VOL`, `CUT` und Werte sichtbar.
- Waveform/Volume betaetigt; UI zeigte `VOL 110%`.
- C2 gespielt; Engine startete und UI zeigte `Bass note 48 released.`.
- Logcat: `BassNode: prepared`, Oboe/AAudio `Engine running`, keine `FATAL EXCEPTION`.
- Beobachtung: Android-Systemlog meldet weiterhin `AppOps attributionTag not declared`; kein App-Crash, aber als spaetere Manifest-Hygiene vormerken.

## Sprint 13 — Voice Macro Controls

Commit-Ziel:

- Native Voice nicht nur per Keyboard anspielbar machen, sondern erste echte Voice-Parameter in Compose bedienen.

Geaendert:

- `VibeCoreUiState` speichert Voice Volume, Dry/Wet, Pitch, Formant und Glide.
- `NativeProjectRepository` persistiert diese Voice-Parameter mit Schema `6`.
- `NativeRuntime` bietet direkte `setVoice*`-Methoden und bereitet den Voice Core nur einmal vor, damit Note-On keine Sliderwerte ueberschreibt.
- `VibeCoreViewModel` hydriert Voice-Parameter beim Start und schreibt jede UI-Aenderung direkt in Native Voice.
- `VibeCoreApp.kt` zeigt im Voice-Screen eine scrollbare Macro-Control-Spalte mit Slidern.

Geprueft:

- `native-android :app:assembleDebug` erfolgreich.
- APK auf `RZCY91QYC9N` installiert und gestartet.
- `VOICE` geoeffnet; Keyboard und scrollbare Macro-Control-Spalte sichtbar.
- Control-Spalte gescrollt; `VOL`, `DRY`, `PIT`, `FMT`, `GLD` sichtbar.
- Formant veraendert; UI zeigte `FMT 9,1st`.
- C2 gespielt; Engine startete mit `VoiceNode`.
- Logcat: `VoiceNode: prepared`, Oboe/AAudio `Engine running`, keine `FATAL EXCEPTION`.

## Sprint 14 — Transport Lifecycle Safety

Geaendert:

- Transportstatus fuer Play, Stop, Tempo, Sample-Cold-Load und Audio Focus sichtbar gemacht.
- Stop und Audio-Focus-Verlust senden Bass/Voice All-Notes-Off vor dem Transport-Stop.
- `NativeRuntime.play()` liefert nach erfolgreichem Engine-Start einen belastbaren Start-Acceptance-Wert.

Geprueft:

- `:app:assembleDebug` mit JDK 17 erfolgreich.
- APK auf `RZCY91QYC9N` installiert.
- Play zeigte `TRANSPORT PLAYING` und `Transport playing through Native Oboe.` bei stabiler Native-Diagnose.
- Stop zeigte `Transport stopped; performance notes released.`; keine `FATAL EXCEPTION`.

## Sprint 15 — Pattern Deep Edit

Geaendert:

- Step-Editor fuer Velocity, Probability, Accent und Roll in Compose ergaenzt.
- Clear, Copy/Paste sowie Undo/Redo arbeiten auf dem kanonischen Kotlin-Projektzustand und replayen das Ergebnis nach Native Groove.
- Persistenzschema auf 7 erweitert; alle neuen Step-Parameter werden geladen, gespeichert und beim Start in Native Groove hydriert.
- Pattern-Status macht jede Editoraktion sichtbar.

Geprueft:

- `:app:assembleDebug` mit JDK 17 erfolgreich.
- Kotlin und JNI/C++ fuer `arm64-v8a`, `armeabi-v7a` und `x86_64` gebaut.
- APK auf `RZCY91QYC9N` installiert und Landscape-Layout sichtbar geprueft.
- Step 1 auf `VEL 95`, `CH 90%`, Accent und `R1` editiert; Undo/Redo sowie Clear/Undo ausgefuehrt.
- Force-Stop/Relaunch stellte alle editierten Step-Werte aus Persistenzschema 7 wieder her.
- Keine `FATAL EXCEPTION` in Logcat.
- Lokale Evidenz: `evidence/vibecore-sprint15-layout-fixed.png`, `evidence/vibecore-sprint15-edited.png`, `evidence/vibecore-sprint15-relaunch.png`, `evidence/vibecore-sprint15-playing.png`, `evidence/vibecore-sprint15-stopped.png`.
- Portrait-Abnahme bleibt fuer einen spaeteren Layout-Gate offen.

## Sprint 16 — Pattern / Scene Banks

Geaendert:

- Acht Pattern-Banks pro Track in `VibeCoreUiState` und `NativeProjectRepository` eingefuehrt.
- Persistenzschema 8 migriert die bisherigen Schema-7-Pattern automatisch nach Bank 1.
- Native Groove API um Pattern-Bank-Auswahl, Scene-Bank-Konfiguration und unmittelbare Scene-Aktivierung erweitert.
- Alle acht Scenes mappen im Audio Thread jeden Track auf den gleichnamigen Pattern-Bankindex.
- Groove-Command-Queue auf 4096 vorallozierte Eintraege erweitert, damit der komplette Bank-Replay vor Transportstart erhalten bleibt.
- Pattern-Editor zeigt die aktuell bearbeitete Bank sichtbar an.

Geprueft:

- `:app:assembleDebug` mit JDK 17 fuer `arm64-v8a`, `armeabi-v7a` und `x86_64` erfolgreich.
- APK auf `RZCY91QYC9N` installiert.
- Bank 2 mit aktivem Step 2 angelegt; Force-Stop/Relaunch stellte Bank 2 wieder her.
- Rueckwechsel zu Bank 1 bestaetigte isolierte Sprint-15-Werte `VEL 95`, `CH 90%`, Accent und `R1`.
- Bei laufendem Transport blieb Scene 2 zunaechst `PENDING` und wurde erst an der Native-Bar-Grenze `ACTIVE`.
- Keine `FATAL EXCEPTION` in Logcat.
- Lokale Evidenz: `evidence/vibecore-sprint16-bank2-relaunch.png`, `evidence/vibecore-sprint16-bank1-return.png`, `evidence/vibecore-sprint16-scene2-pending.png`, `evidence/vibecore-sprint16-scene2-active.png`.

Naechster grosser Sprint:

- Pattern-/Scene-Banks als zusammenhaengendes Projektmodell mit bar-synchronem Native-Groove-Wechsel und Persistenz.
- Danach Mixer-Paritaet mit Pan, Sends und FX-Routing auf Basis der vorhandenen Native Contracts.

## Sprint 17 — Native Mixer Gain / Pan

Geaendert:

- Groove-Track-Volume wird im Native `VoicePool` auf aktive Drum-/Sample-Voices angewendet.
- Stereo-Pan als neuer lockfreier Groove-Command und laufzeitwirksame VoicePool-Balance implementiert.
- Bass/Voice Mixer-Level und Pan werden in die vorhandenen Native-Instrumentparameter gespiegelt.
- Compose-Mixer um getrennte Level-/Pan-Regler erweitert; Mute/Solo bleiben direkt erreichbar.
- Track-Pan in Persistenzschema 9 aufgenommen und beim Start hydriert.

Geprueft:

- `:app:assembleDebug` mit JDK 17 fuer alle drei ABIs erfolgreich.
- APK auf `RZCY91QYC9N` installiert; Landscape-Mixer ohne Ueberlappung sichtbar.
- Kick auf Level `72`, Pan `R58` und Mute gesetzt; Force-Stop/Relaunch stellte alle Werte wieder her.
- Play/Stop nach Relaunch stabil; keine `FATAL EXCEPTION`.
- Lokale Evidenz: `evidence/vibecore-sprint17-mixer.png`, `evidence/vibecore-sprint17-mixer-edited.png`, `evidence/vibecore-sprint17-mixer-relaunch.png`.
- Offen: hoerbarer Pan-/Gain-A/B-Test mit geladenem Referenzsample. Send-/FX-Busse existieren im aktuellen Native Graph noch nicht und sind eigener Sprint.

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
