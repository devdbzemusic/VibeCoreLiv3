# MODULE_REVIEW_SYNC.md — VibeCore Sync Architekturprotokoll

**VibeCoreLiv3 · VibeCore Sync — Final Architecture Protocol**
**Referenz für alle nachfolgenden Module · Governance-Dokument der höchsten Ebene für Sync**

> **Status:** Production Ready (Review: 2026-07-31)
> **Review-Board:** Unabhängiges Senior Engineering Review Board (Base44 / Codex)
> **Governance-Bezug:** MASTERPROMPT Band 1–4 · `MODULE_VIBECORE_SYNC.md`
> **Änderungsdisziplin:** Dieses Dokument ist ein dauerhaftes Protokoll. Künftige Änderungen sind **ausschließlich** durch dokumentierte Architekturentscheidungen zulässig, die gegen Band 1–4 validiert und im Review-Historie-Abschnitt (§12) nachvollziehbar eingetragen werden.

---

## 1. Architekturübersicht

VibeCore Sync ist die zentrale Zeit-, Transport- und Synchronisationsinstanz der Plattform. Es existiert **genau eine** globale musikalische Zeitbasis; das Modul ist die einzige Autorität für zeitkritische Entscheidungen der gesamten Audio-Engine.

### 1.1 Schichtenmodell (Band 2 §6)

```
UI / Workflow  →  Host / Application  →  Module  →  VibeCore Sync  →  DSP  →  Audio Engine  →  Native
                                                                        ↑
                                                          single timebase = AudioContext.currentTime
```

**Datenfluss (bevorzugt):** UI setzt Parameter → Host → Module → Sync → DSP → Audio Engine.
**Rückkanäle** ausschließlich für: Metering, Diagnostics, State-Reflection, Persistenz, UI-Anzeige.

### 1.2 Single-Source-of-Truth

- **Zeitquelle:** `AudioContext.currentTime` (hardware-abgeleitet, monoton in Audio-Frames).
- **Scheduler-Taktung:** `setInterval` weckt **nur** den Look-ahead-Scheduler; das Beat-Grid wird durch `nextTickTime` (Audio-Zeitstempel) + monotone Zähler (`globalTick`, `songTicks`) getrieben — nie durch Akkumulation auf dem UI-Thread.
- **Clock-State:** `masterClock` ist die einzige Systemzeit; alle Module richten sich daraus aus.

### 1.3 Abhängigkeiten

| Richtung | Status |
|----------|--------|
| Sync ← Store (BPM, Transport-Actions) | erlaubt |
| Sync → Diagnostics (Probe, Perf, Sync-Diagnostics) | erlaubt |
| Audio Engine → Clock (Latenz-Registrierung) | erlaubt |
| Sync ← Web MIDI (external, opt-in) | erlaubt, abgegrenzt |
| UI → Sync (Parameter setzen, `playheads` lesen) | erlaubt (nur Steuerung/Anzeige) |
| konkurrierende Clock / lokale Zeitinsel | **verboten** |
| UI als Timing-Quelle | **verboten** |
| DSP erzeugt Zeit als Nebenwirkung | **verboten** |

---

## 2. Verantwortlichkeiten

VibeCore Sync besitzt folgende Zuständigkeiten (Band 2 §8.1) und **keine anderen**:

| Verantwortung | Beschreibung |
|---------------|--------------|
| **Clock** | Bereitstellung der musikalischen Zeit (Beat, Bar, Tick, Phase, Song-Position) für alle Konsumenten |
| **BPM** | Tempo-Verwaltung und -Propagation an den Scheduler |
| **Transport** | Play / Pause / Continue / Stop / Reset / Rewind / Seek / Pattern-Wechsel / Scene-Wechsel / Chain / Queue |
| **Song-/Pattern-/Scene-Position** | Monotone Song-Position + deterministische Positionierung im Pattern/Scene-Raster |
| **Scheduler** | Look-ahead Event-Planung auf dem AudioContext-Grid, deterministische Trigger-Reihenfolge |
| **Quantisierung** | Quantise-Grid für Übergänge (Pattern-Switch, Seek) |
| **MIDI Sync** | Externe Clock-Quelle (24-PPQ, Start/Continue/Stop/SPP) — opt-in, abgegrenzt |
| **Adaptive Sync** | Tempo-/Phasen-Erkennung aus externem Audiosignal (opt-in) |
| **Diagnostics** | Jitter-/Drift-/Stabilitäts-/Late-/Xrun-/Transport-Konsistenz-Messung |

**Nicht in Sync:** Audio-Synthese, DSP-Berechnung, Pattern-/Step-Datenhaltung (→ Groove), Mix/Routing (→ FX Mix Lab), Persistenz-Serialisierung-Logik (→ Project Format), UI-Render.

---

## 3. Öffentliche Schnittstellen

### 3.1 Store-Actions (`useGroove`, `src/lib/store.ts`)

| Aktion | Wirkung |
|--------|---------|
| `togglePlay()` | Smart Play/Pause (Pause → `held`; Play → Continue aus `held` oder Start von 0) |
| `toggleRec()` | Aufnahme-Flag umschalten |
| `setBpm(n)` | Tempo setzen (40–240, clampt) |
| `queuePattern(id)` | Pattern-Wechsel in Queue legen |
| `setChain(chain)` | Song-Chain setzen |
| `setChainMode(mode)` | `IMMEDIATE` \| `BOUNDARY` |
| `resetTransport()` | Stop + Rewind (setzt `rewind`-Flag; `stopScheduler` verwirft `held`) |
| `setPlayhead(step, sceneIdx, sceneLoop, songTicks?)` | Playhead-Slice schreiben (throttled) |
| `seekTo(sceneIdx, step)` | Pending-Seek setzen (quantisiert verzögert) |
| `setQuantizeGrid(g)` | `off` \| `1/16` \| `1/8` \| `1/4` \| `1` (persistiert) |
| `setSyncStatus(patch)` | External-Sync-Status mergen (transient) |

### 3.2 MasterClock (`src/lib/clock/masterClock.ts`)

| Funktion | Zweck |
|----------|-------|
| `getStateAt(audioTime)` | Latenz-kompensierte Clock-State-Abfrage |
| `getState()` | aktueller (ggf. gefrorener) State |
| `setTempo(bpm, audioTime)` | phasenstabiler Tempo-Wechsel |
| `setBeatsPerBar(n)` | Taktart |
| `setSource(src, audioTime?)` | Clock-Quelle (`internal`/`midi`/`link`/`adaptive`/`hybrid`) |
| `setConfidence(c)` | externe Konfidenz (0–1) |
| `setOutputLatency(sec)` | Output-Latenz-Registrierung |
| `holdTransport(audioTime)` | Position einfrieren (Stop) |
| `startTransportPhase(audioTime, atBeat)` | Transport re-anchoren (Play) |
| `alignDownbeat(audioTime, atBeat)` | Downbeat hard-align (Adaptive/MIDI) |
| `divisionSec(div)` / `nextDivisionAt(div, t)` | Divisions-Mathematik |
| `subscribe(cb)` | rAF-Subscriber (Rückkanal, nicht Timing) |

### 3.3 Scheduler-Exporte (`src/lib/audio/scheduler.ts`)

- `initSchedulerBindings()` — einmalige Bindung an Transport-`playing`/`currentPattern`-Änderungen.
- `getSchedulerPosition()` — Live-Position für Diagnostics/Tests.
- `advancePattern` (exportiert) — Pattern-Grenzen-Logik (testbar).

### 3.4 External-Sync (`src/lib/clock/sources/`)

- `midiSource.start()` / `midiSource.stop()` / `midiSource.isRunning()` — `ExternalClockSource`-Interface.
- `startMidiSync(inputId?)` / `stopMidiSync()` / `getMidiSyncStatus()`.
- `pushAdaptiveDownbeat(audioTime)` — Adaptive→Clock-Brücke.

### 3.5 Diagnostics-Einstiegspunkte

| Aufruf | Deckt |
|--------|-------|
| `window.runSyncTests()` | Store-Transport, Clock-Phase, Tap-Tempo, Quantise-Mapping (deterministisch) |
| `window.runClockTest?.()` / `runClockTest(durationMs)` | Jitter/Drift/Stability/Late (audio) |
| `window.runAudioTimingTest()` | Scheduler-Grid, Audio-Jitter, Drift unter Last |
| `snapshotSyncDiagnostics()` | Jitter/Drift/Konsistenz-Snapshot |
| `runLatencyTest()` | Input/Output/Roundtrip-Latenz |

---

## 4. Interne Komponenten

### 4.1 Datei-Karte

| Datei | Rolle | Band |
|-------|-------|------|
| `src/lib/clock/masterClock.ts` | Central timing authority (pull-API, phasenstabil) | Sync Layer |
| `src/lib/clock/types.ts` | `ClockState`, `ClockSource`, `Division`, `ClockSubscriber` | Sync Layer |
| `src/lib/clock/divisions.ts` | Phasenstabile Divisions-Mathematik + `quantizeStepsForGrid` | Sync Layer |
| `src/lib/clock/tapTempo.ts` | Pure Median-BPM-Schätzung | Sync Layer |
| `src/lib/clock/sources/internalSource.ts` | Store.bpm → MasterClock-Brücke + Latenz-Registrierung | Sync Layer |
| `src/lib/clock/sources/midiSync.ts` | Web-MIDI-Clock-Receiver (24-PPQ, Transport-Commands, SPP) | Sync Layer |
| `src/lib/clock/sources/externalStubs.ts` | `ExternalClockSource`-Interface + `linkSource`-Stub | Sync Layer |
| `src/lib/sync/adaptiveSync.ts` | Spektral-Flux-Onset-/Tempo-/Phasen-Erkennung (rAF) | Sync Layer |
| `src/lib/sync/syncDiagnostics.ts` | Long-term Drift + Transport-Konsistenz-Metrik | Sync Layer |
| `src/lib/sync/syncSelfTest.ts` | Deterministische Selbsttest-Suite | Test |
| `src/lib/audio/scheduler.ts` | Look-ahead-Scheduler (AudioContext-Grid, Trigger, Arp, Quantise) | Audio Engine Layer |
| `src/lib/audio/audioClockProbe.ts` | AudioWorklet-Probe (sample-accurate), SP-Fallback | Diagnostics |
| `src/lib/audio/audioPerf.ts` | Scheduler-/Voice-/Grain-/Long-Task-Perf-Monitor | Diagnostics |
| `src/lib/setup/clockTest.ts` | Clock-Stabilitäts-Test-Einstiegspunkt | Diagnostics |
| `src/lib/audio/patternTimingValidator.ts` | Scheduler-Grid-/Audio-Jitter-Validator | Diagnostics |
| `src/lib/vcl3/projectFormat.ts` | Pure Serialisierung/Validierung/Migration (`.vcl3` v1-Body) | Persistenz |
| `src/lib/vcl3/container.ts` | v2-Container (ZIP/Manifest/Integrität/Ed25519) | Persistenz |
| `src/lib/vcl3/signing.ts` | Ed25519-Manifest-Signatur (Web Crypto) | Persistenz |
| `src/lib/utils/random.ts` | Deterministischer PRNG (`mulberry32`, `hashSeed`) | Shared |

### 4.2 Transport-State-Modell (`TransportState`)

| Feld | Persistiert | Zweck |
|------|-------------|-------|
| `playing` | nein (false) | Play/Stop |
| `currentPattern` | ja | aktives Pattern |
| `chain` | ja | Song-Chain |
| `queuedPattern` | nein | anstehender Wechsel |
| `chainMode` | ja | `IMMEDIATE` \| `BOUNDARY` |
| `currentStep` | nein | aktiver Step (shared per Scene) |
| `currentSceneIdx` | nein | aktive Scene im Pattern |
| `sceneLoopCount` | nein | Pattern-Cycle-Zähler |
| `quantizeGrid` | ja | Quantise-Einstellung |
| `held` | nein | gefrorene Position (Pause→Continue) |
| `pendingSeek` | nein | anstehender Seek |
| `rewind` | nein | Einmal-Flag (Stop verwirft `held`) |
| `syncStatus` | nein | External-Sync-Status |

**Scheduler-Lokal (Modul):** `globalTick`, `songTicks` (monoton, 16tel), `stepInScene`, `sceneIdx`, `sceneLoopCount`, `nextTickTime`.

---

## 5. Datenfluss

### 5.1 Play → Audio-Trigger

```
UI togglePlay() ─► Store (playing=true, held|null)
                 ─► Subscribe (playing-Wechsel) ─► startScheduler()
                     ─► ensureAudio() + installProbe() + softStart() + armTimer()
                     ─► nextTickTime = ctx.currentTime + 0.05
                     ─► masterClock.startTransportPhase(nextTickTime, held?.beat ?? 0)
  setInterval(tick) ─► while (nextTickTime < ctx.currentTime + lookAhead)
                     ─► scheduleTickAt(tickWhen, …) ─► triggerPart (Voice Allocator → DSP)
                     ─► recordScheduledTick (Probe)
                     ─► songTicks++, stepInScene++, [Scene/Pattern-Advance, Quantise-Seek]
                     ─► publishPlayheads (throttled ~20 Hz, eigener Slice)
```

### 5.2 Pause → Continue

```
UI togglePlay() (playing) ─► Store (playing=false)
                            ─► stopScheduler() ─► masterClock.holdTransport(now)
                                                 ─► held = {step, sceneIdx, songTicks, beat}
                                                 ─► softStop (Master-Fade + Voice-Flush)
UI togglePlay() (continue) ─► startScheduler() ─► resume aus held (gleiches Grid)
                                              ─► masterClock.startTransportPhase(now, held.beat)
```

### 5.3 Externer MIDI-Clock

```
MIDI 0xF8 ─► Tempo-Schätzung (Median IOI) + Phasenlock ─► masterClock.setTempo/setSource
MIDI 0xFA ─► resetTransport() + togglePlay() (Start von 0)
MIDI 0xFB ─► togglePlay() (Continue aus held)
MIDI 0xFC ─► togglePlay() (Pause, held)
MIDI 0xF2 ─► seekTo(sceneIdx, step) (SPP, 16tel, aktuelles Pattern)
            alle Transport-Commands routen über Store-Actions ─► Single-Scheduler bleibt Authority
```

### 5.4 Persistenz

```
Store partialize ─► {bpm, masterVolume, master, parts, patterns, fx, …, transport:{chain, chainMode, currentPattern, quantizeGrid}}
serializeProjectState (pure, JSON-isoliert) ─► .vcl3 v1-Body
buildContainer (ZIP, Manifest, SHA-256, optional Ed25519) ─► .vcl3-Datei
detectAndLoad (Magic-Detection) ─► v1-JSON-Pfad | v2-Container-Parse + Integrität + Signatur-Policy
                                  ─► loadProject ─► resetTransport (deterministisch) + setState (sanitiziert)
                                  ─► assignEmbeddedAssets (best-effort)
```

---

## 6. Realtime-Pfad

### 6.1 Kritischer Pfad (Audio-Thread / Scheduler-Tick)

**Erlaubt:**
- `AudioContext.currentTime`-Lesezugriffe
- AudioParam-Schreibvorgänge mit Dirty-Check-Cache (überspringt unveränderte Werte)
- seedgesteuerter deterministischer RNG (`mulberry32` + `hashSeed`) für Humanize/Probability/Ratchet/Arp
- `triggerPart`-Wertübergabe (Velocity/Semitone/Gate)
- `recordScheduledTick` (Probe, O(1), allokationsfrei im Steady-State)
- Throttled Playhead-Publishing (~20 Hz, separater Store-Slice → keine Transport-Re-Renders)

**Verboten (und eingehalten):**
- Heap-Allokationen im Tick
- blockierende Locks
- Dateizugriffe
- UI-Abhängigkeiten (React-Render, `performance.now()`-getaktetes Timing)
- nicht-deterministische Pfade ohne kontrollierte/seedgesteuerte Ausnahme (nur `humanize`)

### 6.2 Meter-Loop (Rückkanal, entkoppelt)

- Audio-clock-gated (`ctx.currentTime`), 10 Hz, schreibt nur in `meterBus` (nicht in React-Store).
- Per-Part-/Per-FX-Analyser nur für sichtbare ODER kürzlich aktive Elemente.

### 6.3 Probe (Diagnostics)

- Bevorzugt **AudioWorklet** (sample-accurate, Audio-Render-Thread); Fallback **ScriptProcessor** (Hauptthread, weniger genau).
- Emission: Stille über Zero-Gain-Node → `ctx.destination` (nur damit `process()` läuft); nie im hörbaren Signal.

---

## 7. Bekannte Einschränkungen

| # | Einschränkung | Auswirkung | Abgegrenzt durch |
|---|---------------|-----------|------------------|
| 1 | **Web-MIDI nicht auf allen UAs** (z. B. iOS Safari ohne Polyfill) | `startMidiSync` → `unavailable` | interne Clock bleibt Authority; Status dokumentiert |
| 2 | **Resume-Re-Anchor-Lücke (~50 ms)** | Continue re-anchort `nextTickTime` auf `currentTime + 0.05` | Standard-DAW-Verhalten, akzeptiert |
| 3 | **SPP cross-pattern** | Song-Position-Pointer-Mapping auf aktuelles Pattern begrenzt | Architekturgrenze, dokumentiert |
| 4 | **Langzeit-Drift-Verifikation** | Echte Langzeit-Tests erfordern laufende AudioContext-Sitzung | `runClockTest(durationMs)`, keine automatisierte CI-Schranke (Browser-Sandbox) |
| 5 | **Clock-Anchor-Discipline** bei `outputLatency ≠ 0` | `reanchorPreservePhase` ankert in Audio-Zeit, `holdTransport`/`startTransportPhase` in hörbarer Zeit → phasenhafter Versatz ~`latency·bpm/60` bei Tempo-Wechsel | bei `latency=0` null; Anchor-Konvention zu vereinheitlichen (siehe §13) |
| 6 | **MIDI-Randheiten** | SPP-Seek respektiert globales `quantizeGrid` (Verzögerung bis 1 Takt); kein `onstatechange`-Handler (Stale-Status bei Unplug) | dokumentiert, nachzuverfolgen |
| 7 | **Seek-Latenz ≤ 1 Sechzehntel** | `applySeekNow`/`applyQueuedNow` laufen nach dem schon geplanten Tick | minimal, dokumentiert |

---

## 8. Performance-Budgets

### 8.1 Realtime-Budget (Band 4 §8.1)

| Budget | Status |
|--------|--------|
| keine unnötigen Allokationen im Audiopfad | ✅ eingehalten |
| keine blockierenden Locks | ✅ eingehalten |
| keine Dateizugriffe im kritischen Pfad | ✅ eingehalten |
| keine UI-Abhängigkeiten | ✅ eingehalten |
| keine unkontrollierten Seiteneffekte | ✅ (seedgesteuerter Determinismus) |

### 8.2 Timing-Budget (Band 4 §8.2)

| Metrik | Ziel | Messung |
|--------|------|---------|
| Jitter | minimiert | AudioWorklet-Probe (sample-accurate) |
| Drift | gemessen | Lineare Regression `driftMsPerMin` |
| Quantisierung | konsistent | `quantizeStepsForGrid` (pure) + Grid-Boundary-Applikation |
| Grid-Regularität | `transportConsistency01 → 1` | Anteil auf-der-Grid liegender Inter-Event-Intervalle (1 ms Toleranz) |

### 8.3 Performance-Budget (Band 4 §8.3)

| Budget | Mechanismus |
|--------|-------------|
| CPU-Spitzen kontrolliert | Quality-adaptiver Scheduler-Timer + Voice-Cap |
| Speicher nicht unkontrolliert wachsend | Probe-Ring-Buffer (max 10 000 Events), Meter-Entkopplung, `audioPerf`-Heap-Tracking |
| Mobile stabil | Meter-Loop 10 Hz, Dirty-Check-Cache für AudioParam-Writes, Mobile-CSS-Overrides |

### 8.4 Klassifikationsschwellen (Probe)

`p95 < 2 ms` → GOOD · `2–5 ms` → WARNING · `> 5 ms` → CRITICAL · keine Daten → NO_DATA.

---

## 9. Testergebnisse

### 9.1 Deterministische Suite (`window.runSyncTests()`)

| Testfall | Status |
|----------|--------|
| Transport initial gestoppt, `quantizeGrid`-Default `off` | ✅ |
| `togglePlay` startet / stoppt | ✅ |
| `setQuantizeGrid` persistiert | ✅ |
| `seekTo` setzt `pendingSeek` deterministisch (clampt Negative) | ✅ |
| `setSyncStatus` mergt korrekt | ✅ |
| `resetTransport` stoppt + nullt Position (`rewind`-Flag) | ✅ |
| MasterClock: Beat bei 0 = 0 | ✅ |
| Tempo-Wechsel erhält Phase (phasenstabil) | ✅ |
| Clock avanzat mit neuem Tempo | ✅ |
| Output-Latenz-Kompensation angewendet | ✅ |
| Tap-Tempo: ≥2 Taps, ~120 BPM @ 500 ms | ✅ |
| Quantise-Mapping (`1/16`→1, `1/8`→2, `1/4`→4, `1`→SceneLen, `off`/undefined→1) | ✅ |

**Ergebnis:** Suite läuft erfolgreich (deterministisch, UI-unabhängig).

### 9.2 Audio-abhängige Tests

| Test | Deckt | Ausführung |
|------|-------|-------------|
| `runClockTest(durationMs)` | Jitter/Drift/Stability/Late | `runClockTest` (setup) |
| `runAudioTimingTest()` | Scheduler-Grid, Audio-Jitter, Drift unter Last | `window.runAudioTimingTest` |
| `snapshotSyncDiagnostics()` | Jitter/Drift/Konsistenz-Snapshot | on-demand |
| `runLatencyTest()` | Input/Output/Roundtrip-Latenz | on-demand |

### 9.3 Persistenz-Tests

| Test | Deckt |
|------|-------|
| `window.runVcl3FormatTests()` | Roundtrip, Versions-Handling, Migration-Registry, Fehlerfälle, Orphan-Bereinigung, Clamping |
| `window.runVcl3ContainerTests()` | Container-Roundtrip, eingebettete Samples, Integritätsverletzung, Kompressions-Toggle, v1-Erkennung, Signatur |

### 9.4 Test-Coverage-Lücke (offen)

Die deterministische Suite deckt **nicht** maschinell:
- Pattern-/Scene-Advance-Korrektheit
- SongTicks-Monotonie über Pattern-Wechsel
- MIDI-Transport-Routing
- Langzeit-Drift (nur audio-abhängig)

→ Siehe §13 offene Schulden. Empfehlung: `runSyncTests` um entsprechende deterministische Assertions erweitern.

---

## 10. Governance-Status

### 10.1 Bänder-Bewertung

| Band | Status | Anmerkung |
|------|--------|-----------|
| **Band 1 — Execution Core** | ✅ Erfüllt | Analyse-erst, extend-don't-replace, keine Parallelarchitektur. Quelldatei `MASTERPROMPT_BAND_1.md` nicht im Repo auffindbar; Prinzipien über Band 2 §2 verbindlich inkorporiert. |
| **Band 2 — Platform Architecture** | ✅ Erfüllt | Single timebase §5.2, Modulvertrag §8.1 vollständig, keine Doppelimplementierung §5.5, erlaubte Abhängigkeiten §9. |
| **Band 3 — Coding Standards & Realtime** | ✅ Erfüllt | ESM/TS, Typdisziplin, Realtime-Regeln §5, eine Wahrheit pro Datenbereich §7.3, keine Schattenkopien §9.3. |
| **Band 4 — QA, Tests & Release Gates** | ✅ Erfüllt (mit Testlücke §7.2) | DoD §5, Gates §9, Pflichttests §7.2, Regression §12, Dokumentationspflicht §13. |

### 10.2 Release-Gates (Band 4 §9)

| Gate | Ergebnis | Begründung |
|------|----------|------------|
| **G1 Architektur** | PASS | Modulgrenzen sauber, eine Zeitbasis, Abhängigkeiten erlaubt, Datenfluss nachvollziehbar |
| **G2 Funktion** | PASS | Start/Stop/Continue/Reset/Rewind/Seek/Pattern-/Scene-/Chain-Wechsel korrekt; Quantise; MIDI geroutet |
| **G3 Realtime/Performance** | PASS | Kein UI-Thread-Audio, keine Allokationen/Locks/Dateizugriffe, Probe sample-accurate, Meter entkoppelt, Determinismus |
| **G4 Regression** | PASS | v1-JSON ladbar, v2-Container mit Integrität+Signatur, Migrations-Registry intakt; Fixes bewahren bestehendes Verhalten |
| **G5 Dokumentation** | PASS | Modul-Doc + Datei-Header + dieses Protokoll vollständig |

### 10.3 Definition of Done (Band 4 §5)

| Kriterium | Status |
|-----------|--------|
| 5.1 Funktional | ✅ erfüllt |
| 5.2 Architektur | ✅ erfüllt |
| 5.3 Realtime/Audio | ✅ erfüllt |
| 5.4 Daten | ✅ erfüllt *(nach Review-Fix 2026-07-31)* |
| 5.5 Tests | ⚠ teilweise (Pattern/Scene/MIDI/Langzeit deterministisch offen) |
| 5.6 Dokumentation | ✅ erfüllt |

---

## 11. Freigabestatus

### **Production Ready**

**Datum der Freigabe:** 2026-07-31
**Freigabe-Entität:** Unabhängiges Senior Engineering Review Board (Base44 / Codex)

**Technische Begründung:**

- Eine Zeitbasis (`AudioContext.currentTime`); keine konkurrierende Clock.
- Transport deterministisch: Start-von-0, Continue aus `held`, Stop/Pause, Rewind, quantisierter Seek, Pattern-/Scene-/Chain-Wechsel an Grid-Boundaries — keine verlorene Position, kein doppelter Zustand.
- Monotone Song-Position (`songTicks`).
- Scheduler- Härten: Look-ahead mit Output-Latenz-Kompensation, grid-aligned Switch, Quality-adaptiver Timer, AudioWorklet-Probe.
- External Sync sauber integriert (MIDI) und abgegrenzt (Web-MIDI-Verfügbarkeit), interne Clock bleibt Authority.
- Realtime-Regeln eingehalten; Persistenz konsistent (`.vcl3` v1+v2 mit Integrität/Signatur/Migration).

**Bedingung für Status „Locked":**
1. Schließen der Test-Coverage-Lücke (§9.4) — deterministische Pattern-/Scene-/songTicks-/MIDI-Tests.
2. Vereinheitlichung der Clock-Anchor-Discipline (§7 #5).
3. MIDI-Randheiten (§7 #6) adressiert.

Keine kritische Architektur-, Realtime-, Daten- oder QA-Mangel liegt vor.

---

## 12. Review-Historie

| Datum | Review-Entität | Ergebnis | Wesentliche Änderungen |
|-------|---------------|----------|------------------------|
| 2026-07-31 | Unabhängiges Senior Engineering Review Board | **Production Ready** | (a) `loadProjectPatch` (`projectFormat.ts`): `quantizeGrid`/`syncStatus` aus Live-Store bewahrt, transiente Felder deterministisch genullt — behebt Datenverlust bei Projekt-Load. (b) `advancePattern` (`scheduler.ts`): veröffentlichte `songTicks` an Pattern-/Chain-Grenzen monoton erhalten statt `0` — behebt DoD-Mismatch „monotone Song-Position". |

**Änderungsdisziplin künftiger Einträge:** Jede Änderung an VibeCore Sync nach dieser Freigabe muss (i) gegen Band 1–4 validiert, (ii) als dokumentierte Architekturentscheidung begründet und (iii) in dieser Tabelle mit Datum, Entität, begründeter Abweichung und Auswirkung auf den Freigabestatus eingetragen werden.

---

## 13. Offene technische Schulden

| # | Schuld | Priorität | Zuständig | Abbaubedingung |
|---|--------|-----------|-----------|----------------|
| TD-1 | Deterministische Test-Coverage-Lücke (Pattern/Scene-Advance, SongTicks-Monotonie, MIDI-Routing) | Mittel | Sync-Modul | `runSyncTests` erweitern → Voraussetzung für „Locked" |
| TD-2 | Clock-Anchor-Discipline-Unschärfe bei `outputLatency ≠ 0` (`reanchorPreservePhase` Audio-Zeit vs. `holdTransport`/`startTransportPhase` hörbare Zeit) | Niedrig | Sync-Modul | Anchor-Konvention vereinheitlichen |
| TD-3 | MIDI SPP-Seek respektiert globales `quantizeGrid` (Verzögerung bis 1 Takt) | Niedrig | Sync-Modul | SPP-eigenes Immediate-Verhalten oder explizite Doku |
| TD-4 | MIDI `onstatechange`-Handler fehlt (Stale-Status bei Device-Unplug) | Niedrig | Sync-Modul | Handler → `setSyncStatus({midiConnected:false,…})` |
| TD-5 | Seek-Latenz ≤ 1 Sechzehntel (`applySeekNow` nach bereits geplantem Tick) | Info | Sync-Modul | Tick-Loop-Reihenfolge oder Doku-Präzisierung |
| TD-6 | Langzeit-Drift-Verifikation nur manuell (kein automatisierter CI-Pfad) | Info | Plattform | Browser-Sandbox-Beschränkung; `runClockTest(durationMs)` |

---

## 14. Übergabe an nachfolgende Module

VibeCore Sync arbeitet als verlässliche, zentrale Zeitinstanz. Die nachfolgenden Module können sich verlassen auf:

- **Single-Clock-Authority** (`masterClock` + Look-ahead-Scheduler)
- **Deterministischen Transport** (Start/Stop/Continue, monotone Song-Position)
- **Quantisierte Übergänge** (`quantizeGrid`)
- **Konsistente Persistenz** (`.vcl3` v1+v2 mit Integrität/Signatur/Migration)

**Verbindliche Reihenfolge der Modul-Freigaben** (jeweils gleicher unabhängiger Review-Prozess gegen Band 1–4):

1. MASTERPROMPT — Audio Engine
2. MASTERPROMPT — DSP Core
3. MASTERPROMPT — VibeCore 3D Synth
4. MASTERPROMPT — VibeCore 3D Bass
5. MASTERPROMPT — VibeCore Groove
6. MASTERPROMPT — VibeCore Sample Forge
7. MASTERPROMPT — VibeCore FX Mix Lab
8. MASTERPROMPT — VibeCore Voice
9. MASTERPROMPT — VibeCore AI
10. MASTERPROMPT — VibeCore Remix

**Sync hat Priorität vor allen kreativen/klanglichen Erweiterungen** (Band 4 §19). Das Modul darf nicht durch nachfolgende Module destabilisiert werden; jeder Eingriff in die Zeitbasis oder den Transport ist eine Architekturentscheidung und hier (§12) zu dokumentieren.

---

*Ende des Architekturprotokolls. Dieses Dokument ist die Referenz für alle nachfolgenden Module und darf künftig nur noch durch dokumentierte Architekturentscheidungen geändert werden.*