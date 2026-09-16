# CODEX ARBEITSAUFTRAG — VibeCoreLiv3 Pure Android Compose

**Projekt:** VibeCoreLiv3
**Repo:** `https://github.com/devdbzemusic/VibeCoreLiv3.git`
**Arbeitsbranch:** `revision/pure-android-compose`
**Basisbranch:** `revision/v4-runtime-consolidation`
**Lokaler Pfad:** `G:\\Dev\\VibeCore-Universe`
**Datum:** 2026-09-16

\---

## 1\. Ziel des Auftrags

VibeCoreLiv3 wird von der bisherigen WebView-/React-/WebAudio-Struktur auf eine **reine native Android-App** migriert.

Zielpfad:

```text
Jetpack Compose
→ ViewModel / StateFlow
→ Kotlin NativeRuntime
→ JNI
→ C++ / VibeCoreSync / GrooveEngine / DSP
→ Oboe
```

### Harte Projektregel

**Kein Redesign. Kein Featureverlust.**

Die bestehende Web-App bleibt vorerst als **Golden Master** für Optik, Layout, Navigation, Bedienlogik und Featureumfang.

**Wir tauschen den Unterbau, nicht das Produktdesign.**

\---

## 2\. Bereits umgesetzt

Im Branch `revision/pure-android-compose` existiert bereits:

* Jetpack Compose im bestehenden Android-/Oboe-Modul
* WebView aus dem aktiven Android-Launcher entfernt
* `MainActivity` als native Compose-Activity
* direkter Kotlin→JNI→C++-Pfad
* Native Runtime über bestehenden C++-/Oboe-Core
* VibeCore Neon-/Dark-Design als Compose Theme
* Pattern-Screen
* 16 Tracks
* 16 Steps
* Play/Stop
* BPM-Steuerung
* Native Playhead-Anzeige
* Mute/Solo
* Mixer-Screen
* Track-Lautstärken
* native Persistenz für den ersten Compose-Slice
* Restore von BPM, Steps, Mute/Solo und Lautstärken
* Android Audio Focus
* Android-Dateipicker für Samples
* Android `MediaExtractor` / `MediaCodec`
* Decode zu Mono Float PCM
* direkter Sample-Upload in Native Groove
* deterministische Native Sample-ID = Track/Part-ID
* Persistenz von Sample-URI und Sample-Name
* Restore persistierter Sample-Assets beim App-Start
* UI-/Feature-Parity-Dokument: `docs/PURE\_ANDROID\_UI\_FEATURE\_PARITY.md`

\---

# 3\. ZUERST BRANCH KORREKT HOLEN

```powershell
cd G:\\Dev\\VibeCoreLiv3

git fetch origin revision/pure-android-compose:refs/remotes/origin/revision/pure-android-compose

git switch -c revision/pure-android-compose origin/revision/pure-android-compose
```

Falls der lokale Branch bereits existiert:

```powershell
git switch revision/pure-android-compose
git pull
```

Danach prüfen:

```powershell
git branch --show-current
git log -1 --oneline
```

Erwarteter Branch:

```text
revision/pure-android-compose
```

\---

# 4\. JAVA / GRADLE BLOCKER BEHEBEN

Der erste lokale Android-Build ist bereits vor dem Compiler abgebrochen.

Fehler:

```text
Android Gradle plugin requires Java 17 to run.
You are currently using Java 11.
```

Vorhandenes JDK 17:

```text
C:\\Program Files\\Microsoft\\jdk-17.0.19.10-hotspot
```

Für die aktuelle PowerShell-Sitzung:

```powershell
$env:JAVA\_HOME="C:\\Program Files\\Microsoft\\jdk-17.0.19.10-hotspot"
$env:Path="$env:JAVA\_HOME\\bin;$env:Path"

java -version
```

Erwartung: Java 17.x.

Danach:

```powershell
cd G:\\Dev\\VibeCoreLiv3\\native-android

.\\gradlew.bat --stop
.\\gradlew.bat -version
```

In der Gradle-Ausgabe muss `JVM: 17...` stehen.

\---

# 5\. ERSTER ECHTER BUILD

```powershell
cd G:\\Dev\\VibeCoreLiv3\\native-android

.\\gradlew.bat clean :app:assembleDebug
```

Ab jetzt gilt:

**Compilerfehler sind Arbeitsaufträge.**

Nicht Architektur neu erfinden. Nicht WebView zurückbringen. Nicht auf WebAudio zurückfallen. Nicht Compose entfernen.

Fehler immer minimal und ursachennah beheben.

\---

# 6\. Bekannte statische Stelle zuerst prüfen

Datei:

```text
native-android/app/src/main/java/com/vibecore/app/ui/VibeCoreApp.kt
```

Beim statischen Gegenlesen wurde ein möglicher fehlerhafter positionaler `Text(...)`-Aufruf im Mixer gesehen.

Falls der Compiler dort anschlägt, auf benannte Parameter umstellen:

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

Keine großflächige Rewrite-Aktion.

\---

# 7\. BUILD-REPARATUR-REIHENFOLGE

Fehler immer in dieser Reihenfolge abarbeiten:

1. Gradle / Plugin / Dependency
2. Kotlin Compile
3. Compose API / Imports
4. Android Lifecycle
5. JNI Signaturen
6. C++ Compile
7. Linker
8. APK Packaging
9. Runtime Crash
10. Audio Runtime
11. UI-Parität

Nach jedem Fix erneut:

```powershell
.\\gradlew.bat :app:assembleDebug
```

Keine 20 Änderungen gleichzeitig.

\---

# 8\. KEINE ARCHITEKTURÄNDERUNG OHNE NOT

Verbindliche Zielarchitektur:

```text
Compose UI
    ↓
VibeCoreViewModel
    ↓
NativeRuntime.kt
    ↓
NativeAudioBridge / NativeGrooveAssetBridge
    ↓
JNI
    ↓
C++ Engine
    ↓
Oboe
```

### Nicht erlaubt

* neue WebView
* React als aktive Android-UI
* WebAudio als Android-Audioengine
* JavaScriptInterface als primärer Runtime-Pfad
* zweiter Scheduler
* zweiter Audio-Clock
* zweite Projekt-State-Authority
* Audio-Timing in Compose
* Step-Scheduling über Coroutines/Timer
* `delay()` für musikalische Trigger
* Audioverarbeitung auf dem UI-Thread

### Erlaubt

Compose darf Runtime-Werte nur anzeigen/pollen.

```text
C++ owns musical timing.
Kotlin polling = UI visualization only.
```

\---

# 9\. Nach erfolgreichem APK-Build

Typischer APK-Pfad:

```text
G:\\Dev\\VibeCoreLiv3\\native-android\\app\\build\\outputs\\apk\\debug\\app-debug.apk
```

Prüfen:

```powershell
Get-ChildItem .\\app\\build\\outputs\\apk\\debug\\
```

\---

# 10\. DEVICE E2E — ERSTE PFLICHTMATRIX

## A. App Start

Prüfen:

* App startet ohne WebView
* VibeCore Compose UI erscheint
* kein weißer WebView-Screen
* keine React-Seite
* Native Core wird gefunden
* Diagnose zeigt Native/Oboe verfügbar

## B. Transport

* BPM − / +
* Play
* Stop
* wiederholtes Play/Stop
* Background / Foreground
* Audio Focus Loss / Gain

## C. Pattern

* Track auswählen
* Steps setzen
* Steps löschen
* Playhead läuft
* Mute
* Solo
* App schließen/öffnen
* Steps bleiben erhalten

## D. Mixer

* alle 16 Tracks sichtbar
* Volume ändern
* Mute
* Solo
* Werte nach Neustart erhalten

## E. Sample Import

```text
SAMPLE
→ Sample-/Drum-Track auswählen
→ CHOOSE AUDIO
→ Datei wählen
→ Android Decoder
→ Mono PCM
→ Native Groove
```

Testformate falls vorhanden:

* WAV
* MP3
* AAC / M4A

Prüfen:

* Datei wird geladen
* Sample-Name erscheint
* Groove spielt Sample
* richtige Geschwindigkeit
* richtige Tonhöhe
* insbesondere 44.1-kHz-Datei auf 48-kHz-Output prüfen
* App Neustart
* Sample wird wiederhergestellt
* keine erneute Dateiauswahl erforderlich

\---

# 11\. Audio-Authority prüfen

Es darf im Pure-Android-Build **keine parallel laufende WebAudio-Welt** geben.

Prüfen:

* kein WebView im aktiven Launcher
* kein `AudioContext`
* kein Browser-Scheduler
* kein WebAudio-Master
* kein Browser-LFO als Audio-Authority
* keine JS→Kotlin→JNI-Kette im aktiven Compose-Pfad

Ziel:

```text
ONE AUDIO AUTHORITY = C++ / Oboe
ONE MUSICAL CLOCK = VibeCoreSync
```

\---

# 12\. UI / OPTIK

Sehr wichtig:

Die bestehende Oberfläche ist der Golden Master.

Nicht auf Android-Material-Standardoptik umdesignen.

Erhalten:

* Deep Space Navy Hintergrund
* Cyan Neon Primary
* Violet / Magenta / Lime / Amber Akzente
* dunkle Panels
* Glow-Eindruck
* große Performance-Flächen
* 16-Step-Groovebox-Charakter
* klare Track-Farben
* Touch-Bedienung
* bestehende Navigation möglichst exakt

Ein Screen gilt erst als portiert wenn:

```text
LOOK    ✓
INPUT   ✓
STATE   ✓
AUDIO   ✓
PERSIST ✓
E2E     ✓
```

\---

# 13\. Nach erstem grünen Build NICHT stoppen

Nach erfolgreichem ersten Build direkt weiter mit der Pure-Android-Migration.

## Phase 1

1. Pattern
2. Mixer
3. Sample Import

Diese existieren bereits und müssen lokal stabilisiert werden.

## Phase 2

4. Voice Compose UI
5. Bass3D Compose UI
6. vollständiges Sample Forge

## Phase 3

7. Synth3D Native Renderer + UI
8. FX
9. Sends
10. Piano Roll

## Phase 4

11. Scenes / Pattern Banks
12. Motion / Automation
13. Arp
14. MIDI
15. Settings
16. Diagnostics
17. AI UI

\---

# 14\. Voice

Der Native Voice Core existiert bereits.

Keine neue Voice-Engine bauen.

Compose soll direkt vorhandene Native Voice-Controls bedienen:

* Pitch
* Formant
* Volume
* Dry/Wet
* Monitor
* Glide
* Pan
* Width
* Live Input
* Harmonizer
* Dynamics
* EQ
* Breath
* LFO / Modulation

Mikrofon-Permission weiterhin erst bei tatsächlicher Live-Input-Nutzung anfordern.

\---

# 15\. Bass3D

Bestehenden Native Bass Core verwenden.

Keine zweite Bass Engine bauen.

Portieren:

* Note On/Off
* Waveform
* Morph
* Detune
* Filter
* Envelope
* LFO
* Mod Matrix
* Glide
* Width
* Drive
* Voice Mode
* Performance Keyboard

\---

# 16\. Synth3D

Native 3D Synth ist derzeit noch eine echte Lücke.

Nicht heimlich auf WebAudio zurückfallen.

Vorgehen:

1. bestehenden Web-Synth nur als Verhaltens-/UI-Referenz lesen
2. Native-DSP-Contract definieren
3. C++ Synth Node erstellen/erweitern
4. JNI
5. Kotlin Runtime
6. Compose UI
7. E2E

Bis dahin Synth3D klar als `NOT YET PORTED` behandeln.

\---

# 17\. Sample Forge Vollausbau

Aktuell existiert bereits echter nativer Sample-Import.

Noch zu portieren:

* Waveform
* Start / End Marker
* Slice Marker
* Normalize
* Reverse
* Trim
* Fade
* Pitch
* Time Stretch
* Auto Chop
* Slice Trigger
* Grain Controls
* Freeze
* Export / Import Presets

Kein WebAudio zum Previewen verwenden.

Preview muss über den Native Sample-/Audio-Pfad laufen.

\---

# 18\. Projektpersistenz

Aktuell existiert eine kleine native Übergangspersistenz.

Sie ist **nicht** das endgültige Projektformat.

Langfristiges Ziel: kanonisches Android-Projektmodell mit Migration aus dem v13-Webmodell.

Nicht zwei dauerhafte Projektformate parallel weiterentwickeln.

Übergangspersistenz erst entfernen, wenn das vollständige Projektmodell nativ vorhanden und getestet ist.

\---

# 19\. DOKUMENTATION NACH JEDEM GRÖSSEREN FIX

Aktualisieren:

```text
docs/PURE\_ANDROID\_UI\_FEATURE\_PARITY.md
```

und bei Buildfortschritt zusätzlich:

```text
docs/HANDOVER\_CODEX\_PURE\_ANDROID\_2026-09-16.md
```

Statusbegriffe:

```text
NOT PORTED
PORTING
STATICALLY VERIFIED
BUILD VERIFIED
DEVICE VERIFIED
PARITY VERIFIED
```

Keine falschen `VERIFIED`-Claims.

\---

# 20\. GIT REGELN

Arbeitsbranch:

```text
revision/pure-android-compose
```

Nicht direkt auf `main`.

Regelmäßig kleine Commits:

```text
fix(android): ...
feat(compose): ...
feat(native): ...
test(android): ...
docs(android): ...
```

Keine riesigen Mischcommits.

\---

# 21\. WANN CODEX ANHALTEN SOLL

Codex darf selbstständig durcharbeiten.

Nur anhalten wenn:

1. irreversible Architekturentscheidung nötig
2. bestehende C++ Engine müsste grundsätzlich ersetzt werden
3. Datenverlust-/Projektformat-Risiko besteht
4. Native DSP-Verhalten ist nicht aus Source ableitbar
5. Hardware-/Gerätetest benötigt Benutzerinteraktion
6. Permission/Systemdialog erfordert Benutzeraktion

Normale Compilerfehler sind **kein Stop-Grund**.

\---

# 22\. Definition des lokalen Meilensteins

```text
\[ ] Branch korrekt
\[ ] Java 17 aktiv
\[ ] Gradle startet
\[ ] Kotlin kompiliert
\[ ] C++ kompiliert
\[ ] APK gebaut
\[ ] APK installiert
\[ ] Compose startet
\[ ] WebView nicht aktiv
\[ ] Pattern funktioniert
\[ ] Mixer funktioniert
\[ ] Sample Import funktioniert
\[ ] Sample Playback funktioniert
\[ ] Persistenz funktioniert
\[ ] kein paralleles WebAudio
\[ ] UI optisch erkennbar VibeCore
```

\---

# 23\. Kurzfassung für Codex

**Nicht neu erfinden. Nicht redesignen. Nicht zurück ins Web.**

Ziel:

```text
VibeCore wie bisher aussehen lassen
+
alle Funktionen erhalten
+
WebView entfernen
+
WebAudio entfernen
+
Compose/Kotlin für UI/State/Android
+
C++/Oboe für Audio/DSP/Timing
```

Compiler zuerst sprechen lassen. Danach Gerät. Danach Screen für Screen Parität herstellen.
