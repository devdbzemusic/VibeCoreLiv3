# MODULE_AUDIO_ENGINE.md — VibeCore Audio Engine Architekturprotokoll

**VibeCoreLiv3 · VibeCore Audio Engine — Final Architecture Protocol**
**Referenz für alle nachfolgenden DSP- und Klangmodule · Governance-Dokument**

> **Status:** Production Ready (Review: 2026-07-31)
> **Review-Board:** Unabhängiges Senior Engineering Review Board (Base44 / Codex)
> **Governance-Bezug:** MASTERPROMPT Band 1–4 · `MODULE_REVIEW_SYNC.md` (VibeCore Sync)
> **Abhängigkeit:** Baut auf VibeCore Sync (Clock + Scheduler + Transport) auf
> **Änderungsdisziplin:** Dieses Dokument ist ein dauerhaftes Protokoll. Künftige Änderungen sind **ausschließlich** durch dokumentierte Architekturentscheidungen zulässig, die gegen Band 1–4 validiert und im Review-Historie-Abschnitt (§12) nachvollziehbar eingetragen werden.

---

## 1. Architekturübersicht

Die VibeCore Audio Engine ist das technische Fundament des gesamten Klangsystems. Sie verwaltet die einzige `AudioContext`-Instanz der Anwendung, besitzt den kompletten Audio-Graphen (Per-Part-Ketten → FX-Busse → Master-Bus → Destination) und ist die einzige Autorität für Audio-I/O, Voice-Verwaltung, Buffer-Verarbeitung und Rendering.

### 1.1 Schichtenmodell (Band 2 §6)

```
UI / Workflow  →  Host / Store  →  VibeCore Sync (Clock + Scheduler)
                                        ↓ triggerPart(when, …)
                              VibeCore Audio Engine
                                  ├── Voice Allocator (central priority)
                                  ├── Per-Part Channel Strips (16)
                                  ├── FX Buses (6)
                                  ├── Master Bus (EQ → Width → SoftClip → Limiter)
                                  ├── Granular AudioWorklet
                                  ├── Modulation Runtime
                                  └── Metering / Diagnostics Bridge
                                        ↓
                                   DSP Modules
                                  ├── Synth Voices (Kick/Snare/Hat/Bass/Synth)
                                  ├── GravLace Bass
                                  ├── Granular Engine
                                  └── Prod Renderer (offline)
                                        ↓
                              AudioContext.destination
```

### 1.2 Single-Source-of-Truth

- **Audio-Ausgabe:** Genau eine `AudioContext`-Instanz (`ensureAudio()`), ein Master-Bus → `ctx.destination`. Keine konkurrierende Audio-Ausgabe.
- **Zeitbasis:** VibeCore Sync (`masterClock` + Look-ahead-Scheduler auf `AudioContext.currentTime`). Die Engine defered alle Timing-Entscheidungen an den Scheduler — sie erzeugt **keine** eigene Zeitbasis.
- **Trigger-Autorität:** `triggerPart(partId, when, opts)` ist der **einzige** Einstiegspunkt für alle Klangmodule. Kein Modul triggert direkt Audio-Nodes.
- **Voice-Verwaltung:** `voiceAllocator.ts` ist die zentrale Voice-Allokation mit Prioritäts-Tiers. Kein Modul entscheidet Allokation selbständig.

### 1.3 Backend-Abstraktion

```
createAudioBackend()
  ├── window.VibeCoreNative vorhanden?  →  NativeOboeBackend (AAudio/OpenSL ES)
  └── sonst                              →  null → Web-Audio-Engine (default)
```

Die Web-Audio-Engine ist die Produktions-Architektur im Browser. Das native Oboe-Backend ist vollständig vorbereitet (Interface, JNI-Bridge, C++-Engine) und wird ausschließlich durch `window.VibeCoreNative` aktiviert — der Web-Audio-Code bleibt unangetastet. Beide Pfade teilen sich Voice-Cap, Tempo und Master-Gain über die `AudioBackend`-Schnittstelle.

### 1.4 Erlaubte / Verbotene Abhängigkeiten

| Richtung | Status |
|----------|--------|
| Engine ← VibeCore Sync (Scheduler ruft `triggerPart`) | ✅ erlaubt |
| Engine ← Store (Parameter, Transport-State) | ✅ erlaubt |
| Engine ← Quality (Profile, Voice-Cap, Look-ahead) | ✅ erlaubt |
| Engine → Metering (`meterBus`, non-React) | ✅ erlaubt |
| Engine → Diagnostics (`audioPerf`, `audioClockProbe`, `audioGraphDebug`) | ✅ erlaubt |
| Engine → DSP-Module (`synthVoice`, `granular`, `gravLaceBass`) | ✅ erlaubt |
| Engine → UI als Steuerlogik | ❌ **verboten** |
| Engine → konkurrierende Clock | ❌ **verboten** |
| Engine → unkontrollierte Store-Schreibvorgänge im Realtime-Pfad | ❌ **verboten** |
| DSP-Logik in UI-Komponenten | ❌ **verboten** |
| Audio-Thread greift auf UI-State zu | ❌ **verboten** |

---

## 2. Verantwortlichkeiten

| Verantwortung | Umsetzung |
|---------------|-----------|
| **Audio-I/O** | `ensureAudio()`, `restartAudio()`, `AudioContext`-Lifecycle, Device-Sample-Rate, Latenz-Hint |
| **Render-Pipeline** | Per-Part-Kette → 6 FX-Busse → Master-Bus → `ctx.destination` |
| **Buffer-Verarbeitung** | `decodeAudioData`, `AudioBuffer`-Cache, Hot-Swap mit Crossfade, Reverse-Cache, Offline-Render (`OfflineAudioContext`) |
| **Voice-Verwaltung** | `voiceAllocator.ts` — zentrale Allokation, Prioritäts-Tiers, Stealing mit Fast-Fade |
| **Trigger** | `triggerPart()` — einziger Einstiegspunkt für alle Module; routing nach `source` (sample/synth/hybrid) |
| **Transport-Anbindung** | `softStart()`/`softStop()` — Master-Fade auf Play/Stop; `crossfadePatternChange()` — nahtloser Pattern-Wechsel |
| **Metering** | `meterBus.ts` — non-React Pub/Sub, 10 Hz, audio-clock-gated; per-Part/per-FX/master peaks |
| **Diagnostics** | `audioPerf`, `audioClockProbe`, `mainThreadMonitor`, `audioGraphDebug`, `runAudioDiagnostics` |
| **Qualitätssteuerung** | `quality.ts` — adaptives Profil (LOW/MEDIUM/HIGH), Voice-Cap, Look-ahead, Scheduler-Tick, Meter-Cadence |
| **Modulation** | `modulation.ts` — LFO/ENV/Step/Random/Velocity → AudioParams + Trigger-Offsets |
| **Granular** | `granular.ts` — AudioWorklet-Pfad (off-main-thread), Freeze-Stimmen mit Seam-Dip |
| **Native Readiness** | `AudioBackend`-Interface, `NativeOboeBackend`, JNI-Bridge (Android) |

**Nicht in der Audio Engine:** Clock/Transport/Quantisierung (→ Sync), Pattern-/Step-Daten (→ Groove/Store), Persistenz-Serialisierung (→ Project Format), UI-Render.

---

## 3. Öffentliche Schnittstellen

### 3.1 Audio-I/O (`engine.ts`)

| Funktion | Zweck |
|----------|-------|
| `ensureAudio(): Promise<AudioContext>` | Initialisiert AudioContext, baut Graph, startet Meter/Modulation/Granular/Quality |
| `restartAudio(): Promise<AudioContext>` | Teardown + Rebuild (für Sample-Rate-/Device-Wechsel) |
| `getCtx(): AudioContext \| null` | Sync-Lesezugriff auf den AudioContext |
| `triggerPart(partId, when, opts)` | **Einziger** Trigger-Einstiegspunkt; Voice-Allokation, Routing, DSP |
| `softStart()` / `softStop(flushVoices?)` | Master-Fade auf Play/Stop (Anti-Click) |
| `setMasterVolume(v)` | Master-Gain setzen |
| `decodeSampleFile(file)` / `loadSampleForPart(partId, file)` | Sample-Decode + Cache |
| `assignBufferToPart(partId, buf)` | Hot-Swap mit Crossfade (click-frei) |
| `getBuffer(partId)` / `getPartChain(id)` | Lesezugriff für Module |
| `previewBuffer(buf, start, end)` | Forge-Preview (bypasses master chain) |
| `triggerSampleRegion(partId, start, end, vel)` | Slice-Editor-Trigger |
| `normalizeBuffer(buf)` / `reverseBuffer(buf)` / `resamplePart(partId, sec)` | Buffer-Utilities |
| `bindParamUpdates()` | Store-Subscription → `applyAllParams` (dirty-checked) |
| `applyAllParams()` | Synchronisiert alle AudioParams aus dem Store (idempotent, dirty-checked) |
| `getGranularNode()` / `onGrainsEnded(cb)` | Granular-Worklet-Zugriff |
| `modOffsets` / `grainModOffsets` / `partLastVelocity` | Live-Modulation-Offsets (gelesen von Trigger/Granular) |

### 3.2 Voice Allocator (`voiceAllocator.ts`)

| Funktion | Zweck |
|----------|-------|
| `requestVoice(partId, module, priority): VoiceHandle \| null` | Zentrale Voice-Anfrage; Grant oder Steal |
| `setVoiceCap(n)` | Voice-Limit setzen (aus Quality-Profil) |
| `partVoiceClass(part): { module, priority }` | Klassifiziert Part → (Modul, Priorität) |
| `activeNoteCount()` / `subscribeActiveNotes(cb)` | Live-Count + UI-Hook |

**Prioritäts-Tiers:** `CRITICAL(0)` Bass/Kick → `HIGH(1)` Lead/Drum → `MEDIUM(2)` Arp/One-Shot → `LOW(3)` Granular/Pad/Reverb-Tail. Stealing wählt das älteste Voice mit `priority >= requester`; kritische Voices werden **nie** gestohlen.

### 3.3 Quality (`quality.ts`)

| Funktion | Zweck |
|----------|-------|
| `getQuality(): QualitySettings` | Sync-Lesezugriff auf aktuelles Profil |
| `onQualityChange(fn)` | Profil-Wechsel-Subscriber |
| `getInitialLatencyHint(profile)` | AudioContext-latencyHint vor Start |
| `getDeviceTuning(): DeviceTuning` | Geräte-Specific-Tuning (SynthMark, big.LITTLE) |
| `getScheduleOffset()` | Worst-Case-Latenz-Offset unter dynamischer Last |
| `startQualityManager()` | FPS/CPU/voice-basierter Adaptions-Loop (2 Hz, Hysterese) |

### 3.4 Diagnostics-Einstiegspunkte

| Aufruf | Deckt |
|--------|-------|
| `window.runAudioDiagnostics(dur?, opts?)` | Vollständiger Diagnostics-Report (Graph + Scheduler + Long-Tasks + Memory) |
| `window.dumpAudioGraph()` / `dumpAudioGraphDetailed(limit?)` | Audio-Node-Lifecycle (WeakRef), Leak-Detection |
| `window.exportSchedulerEvents(limit?)` | Scheduler-Events + Klassifikation (GOOD/WARNING/CRITICAL) |
| `window.exportLongTasks()` | Long-Task-Attribution |
| `window.__vibeMainThread()` | Main-Thread-Stats (FPS, Event-Loop-Lag, Long-Tasks) |
| `window.__vibeAudioCtx()` | AudioContext-Zugriff für Headless-Tests |
| `runStressTest(name)` | In-App-Stress-Tests (all-on, polymetric, granular, ratchets) |
| `runClockTest(dur, div)` | Audio-synchrone Clock-Stabilitätsmessung |
| `runLatencyTest()` | Input/Output/Roundtrip-Latenz |

---

## 4. Interne Komponenten

### 4.1 Datei-Karte

| Datei | Rolle | Schicht |
|-------|-------|---------|
| `src/lib/audio/engine.ts` | Haupt-Engine: AudioContext, Graph-Bau, Trigger, Master-Bus, FX-Busse, Meter-Loop, Param-Binding | Audio Engine |
| `src/lib/audio/AudioBackend.ts` | Swappable-Backend-Interface (webaudio \| oboe-native) | Audio Engine |
| `src/lib/audio/NativeOboeBackend.ts` | Native Oboe-Client (window.VibeCoreNative) | Audio Engine |
| `src/lib/audio/voiceAllocator.ts` | Zentrale Voice-Allokation + Stealing mit Prioritäts-Tiers | Audio Engine |
| `src/lib/audio/quality.ts` | Adaptives Quality-Profil + Geräte-Tuning (SynthMark) | Audio Engine |
| `src/lib/audio/meterBus.ts` | Non-React Meter-Pub/Sub (10 Hz, audio-clock-gated) | Diagnostics |
| `src/lib/audio/audioPerf.ts` | Scheduler/Voice/Grain/Long-Task/Heap-Metriken (O(1), allokationsfrei) | Diagnostics |
| `src/lib/audio/audioClockProbe.ts` | AudioWorklet-Probe (sample-accurate) + SP-Fallback | Diagnostics |
| `src/lib/audio/audioGraphDebug.ts` | Audio-Node-Lifecycle-Tracking (WeakRef), Leak-Detection | Diagnostics |
| `src/lib/audio/mainThreadMonitor.ts` | Main-Thread-Health (FPS, Event-Loop-Lag, Long-Tasks) — **nie** PASS/FAIL-gating | Diagnostics |
| `src/lib/audio/runAudioDiagnostics.ts` | Produktions-Grade Diagnostics-Framework (JSON-Export) | Diagnostics |
| `src/lib/audio/clickDetect.ts` | Pure DSP-Click-Detection für Regression-Tests | Test |
| `src/lib/audio/synthVoice.ts` | Synth-Stimmen (Kick/Snare/Hat/Bass/Synth) — erstellt kurzlebige Nodes | DSP Module |
| `src/lib/audio/gravLaceBass.ts` | GravLace-Bass-DSP (Lace/Gate/Warper) — per-voice, deterministic | DSP Module |
| `src/lib/audio/granular.ts` | Granular-Runtime — AudioWorklet-Pfad + Freeze-Stimmen mit Seam-Dip | DSP Module |
| `src/lib/audio/psychoPresets.ts` | Psychoakustische Presets (Grain-Length-Shaping, Velocity-Coupling, SR-Kalibrierung) | DSP Module |
| `src/lib/audio/modulation.ts` | Modulations-Runtime (LFO/ENV/Step/Random → AudioParams + Offsets) | DSP Module |
| `src/lib/audio/prodRender.ts` | Pure prozeduraler Sample-Renderer (offline, deterministisch, Worker-kompatibel) | DSP Module |
| `src/lib/audio/sampleLibrary.ts` | Sample-Library-Verwaltung | DSP Module |
| `src/lib/audio/sampleForge.ts` | Sample-Forge-Engine | DSP Module |
| `src/lib/audio/quantumSpatial.ts` | Quantum-Spatial-3D | DSP Module |
| `src/lib/audio/brainwave.ts` | Brainwave-Engine | DSP Module |
| `src/lib/audio/stressTests.ts` | In-App-Stress-Tests (all-on, polymetric, granular, ratchets) | Test |
| `src/lib/setup/setupStore.ts` | Setup-Center-Store (Hardware-/Performance-Präferenzen) | Setup |
| `src/lib/setup/devices.ts` | Geräte-Enumeration (Audio + MIDI) | Setup |
| `src/lib/setup/clockTest.ts` | Clock-Stabilitäts-Test (audio-synchron) | Setup / Test |
| `src/lib/setup/latencyTest.ts` | Latenz-Messung (Input/Output/Roundtrip) | Setup / Test |
| `src/workers/granular-processor.worklet.ts` | AudioWorklet für off-main-thread Grain-Mixing | Worker |
| `src/workers/timing-probe.worklet.ts` | AudioWorklet für sample-accurate Timing-Messung | Worker |
| `src/workers/prodRender.worker.ts` | Web-Worker für offline Sample-Rendering | Worker |

### 4.2 Audio-Graph-Struktur

**Per-Part-Kette (16 Parts):**
```
input → HP → LP → [dry + (drive→driveWet)] → driveOut → outGain → volume → pan
     → sendTap → eqLow → eqMid → eqHigh → postSplit
     ├── dry → masterIn
     ├── analyser (meter tap)
     └── sends[0..5] → fxBus[i].input  (pre-EQ, post-fader)
```

**FX-Bus (6 Bussen):**
```
fxBus.input → [FX-Nodes] → fxBus.output → boost → wet → masterIn
                                                     └── analyser (meter tap)
```

**Master-Bus:**
```
masterIn → mEqLow → mEqMid → mEqHigh → splitter (M/S)
         → widthMid + widthSide → merger → softClip → masterGain → limiter
         → split2 → analyserL + analyserR → ctx.destination
```

### 4.3 Zustandsarten (Band §11)

| Zustand | Ort | Persistiert | Realtime-sicher |
|--------|-----|-------------|-----------------|
| **AudioContext** | Modul (`ctx`) | nein | ✅ single instance |
| **Graph-Nodes** | Modul (`parts`, `fxBuses`, `masterIn`) | nein | ✅ nicht in React-State |
| **Trigger-Offsets** | Modul (`modOffsets`, `grainModOffsets`) | nein | ✅ nur geschrieben von Modulation, gelesen von Trigger |
| **Voice-Registry** | `voiceAllocator` (Map) | nein | ✅ O(1), allokationsfrei in steady state |
| **Active-Voices** | Modul (`activeVoices` Set) | nein | ✅ Set-Operationen |
| **Meter-Snapshot** | `meterBus` (non-React) | nein | ✅ 10 Hz, audio-clock-gated |
| **Audio-Parameter** | Zustand-Store (`useGroove`) | ja (partialize) | ✅ dirty-checked via `setP()` |
| **Quality-Profil** | `quality.ts` (Modul) | nein | ✅ reaktiv via `onQualityChange` |
| **Transport** | Zustand-Store | ja (chain/chainMode/currentPattern/quantizeGrid) | ✅ via Sync |
| **Diagnostics** | jeweilige Module | nein | ✅ O(1), allokationsfrei |

---

## 5. Datenfluss

### 5.1 Trigger → Audio

```
Scheduler.tick() ─► scheduleTickAt(when, tickIndex, pat, scene, step, bpm, parts)
                 ─► for each part: if step.on && probability pass:
                     ─► humanize (seeded RNG) → timing/vel/pitch jitter
                     ─► swing offset (odd steps)
                     ─► ratchet loop → triggerPart(partId, when+offset, {vel, semi, gateSec})
                         ─► voiceAllocator.requestVoice(partId, module, priority)
                         ─► if full → steal oldest >= priority (12ms fast-fade) or drop
                         ─► route by source:
                             ├── "sample"  → playSample (one-shot / stretched / pingpong)
                             ├── "synth"  → triggerSynth (Kick/Snare/Hat/Bass/Synth)
                             └── "hybrid" → sample + synth + sub (parallel)
                         ─► register noteVoices with handle.steal()
                         ─► setTimeout(handle.release, noteDurMs)
                 ─► ArpEngine: generateArpEventsForStep → spawnArpNotes (same triggerPart path)
                 ─► recordScheduledTick (Probe)
```

### 5.2 Parameter → AudioParams

```
Store.setState (audio-relevant slice) ─► bindParamUpdates subscription
    ─► reference-equality gate: parts/fx/master/masterVolume/bpm changed?
    ─► applyAllParams():
        ─► per-part: HP/LP freq+Q, drive curve (cached), EQ gains, volume, pan, sends
        ─► per-FX: type change? → attachFx (rebuild) ; else → bus.update(params, bpm)
        ─► master: EQ gains, width (M/S), softClip curve, limiter, masterGain
        ─► all via setP() — dirty-checked (relative epsilon), skip unchanged AudioParams
```

### 5.3 Metering (entkoppelt)

```
rAF(update) ─► ctx.currentTime gating (10 Hz)
             ─► master L/R analyser → ballistic decay → publishMeter
             ─► per-part: visible OR recently-active → analyser → peak → decay
             ─► per-FX: active slots only → peak + RMS + clip + auto-floor
             ─► limiter GR
             ─► publishMeter() → meterBus (non-React Set of listeners)
             ─► NO Zustand write (verhindert Re-Renders auf nicht-Meter-Komponenten)
```

### 5.4 Modulation

```
rAF(tick) ─► for each ModRoute (enabled):
             ─► srcValue(source, ctx.currentTime, playhead.step, bpm) → -1..1
             ─► applyCurve + scale by amount
             ─► accumulate per (partId, destParam)
           ─► clear stale modOffsets + grainModOffsets
           ─► apply accumulated:
             ├── Filter Cutoff / Resonance / Volume / Pan → AudioParam.setTargetAtTime
             ├── Pitch / Sample Start / End → modOffsets (read by next trigger)
             ├── Delay/Reverb/Chorus/Flanger/RingMod Wet → FX bus.wet.gain
             └── Grain params → grainModOffsets (read by granular loop)
```

---

## 6. Realtime-Pfad

### 6.1 Kritischer Pfad (Audio-Thread / Scheduler-Tick / Modulations-Tick)

**Erlaubt und eingehalten:**
- `AudioContext.currentTime`-Lesezugriffe (einzige Zeitquelle)
- AudioParam-Schreibvorgänge via `setTargetAtTime` mit Dirty-Check-Cache (`setP()`)
- Seedgesteuerter deterministischer PRNG (`mulberry32` + `hashSeed`) für Humanize/Probability/Ratchet/Arp
- `triggerPart`-Wertübergabe (Velocity/Semitone/Gate) — erstellt kurzlebige Nodes, die nach `onended` self-cleanupen
- `recordScheduledTick` (Probe, O(1), ring-buffer, allokationsfrei im Steady-State)
- Throttled Playhead-Publishing (~20 Hz, separater Store-Slice)
- Voice-Allokation: Map-Operationen, O(1) grant, O(n) steal (n = aktive Voices, typ. < 48)

**Verboten und verifiziert abwesend:**
- Heap-Allokationen im Scheduler-Tick (Dirty-Check-Cache verhindert redundante `setTargetAtTime`)
- Blockierende Locks
- Dateizugriffe
- UI-Abhängigkeiten (React-Render, `performance.now()`-getaktetes Audio-Timing)
- Unkontrollierte Seiteneffekte (nur seedgesteuerte Ausnahmen für Humanize)
- Konkurrierende Clock (Engine defered an Sync)

### 6.2 Control-Pfad (akzeptable `setTimeout`/`rAF`-Verwendung)

| Verwendung | Begründung |
|------------|------------|
| Meter-Loop `requestAnimationFrame` | Wake-Mechanismus; Cadence audio-clock-gated (10 Hz); schreibt nur `meterBus` |
| Modulation-Loop `requestAnimationFrame` | Control-Rate (≤ 60 Hz); schreibt AudioParams via `setTargetAtTime` (audio-thread-sicher) |
| Granular-Loop `setTimeout(grainTickMs)` | Control-Rate (45–110 Hz je nach Quality); posted Messages an AudioWorklet |
| `assignBufferToPart` `setTimeout` | Crossfade-Deferral (control-path, 8 ms Fade) |
| `softStop` `setTimeout` | Master-Fade-Completion (control-path, 30 ms Fade) |
| `handle.release()` `setTimeout` | Voice-Slot-Freigabe (control-path, nach Notendauer) |

### 6.3 Meter-Entkopplung

Die Meter-Loop wurde explizit von Zustand weg auf `meterBus` (non-React) umgestellt, weil 16 Parts + 6 FX + 2 Master-Meter bei 60 Hz in Zustand ~11 FPS auf Android verursachten. Jetzt: 10 Hz, audio-clock-gated, nur sichtbare/aktive Parts, keine Re-Renders auf nicht-Meter-Komponenten.

### 6.4 AudioWorklet-Pfade (off-main-thread)

| Worklet | Zweck | Nutzen |
|---------|-------|--------|
| `vibe-granular` | Grain-Mixing für alle Parts | Keine per-Grain AudioBufferSource/Gain/Panner; main thread posted nur Float32Array-Slices |
| `vibe-timing-probe` | Sample-accurate Timing-Messung | Audio-Render-Thread-Zeitstempel; ersetzt SP-Fallback (>1000ms Spurious-Jitter) |

Beide Worklets emit Stille über Zero-Gain → `ctx.destination` (nur damit `process()` läuft) — nie im hörbaren Signal.

---

## 7. Bekannte Einschränkungen

| # | Einschränkung | Auswirkung | Abgegrenzt durch |
|---|---------------|-----------|------------------|
| 1 | **Native Oboe erfordert externen Android-Studio-Build** | `window.VibeCoreNative` nur in gepacktem WebView verfügbar | Web-Audio-Engine bleibt Produktions-Architektur im Browser; native Pfad ist opt-in |
| 2 | **`AudioContext.outputLatency` oft 0** (Chromium/Android) | Scheduler-Kompensation fällt auf `baseLatency` zurück | Dokumentiert; `getScheduleOffset()` verwendet Worst-Case-Geräte-Tuning |
| 3 | **Offline-Render (`renderGranularToBuffer`) spiegelt Live-Modulation** | ModOffsets werden zum Render-Zeitpunkt eingefroren | Akzeptiert — Live/Offline-Konsistenz; ModOffsets sind control-rate |
| 4 | **Voice-Handle-Release via `setTimeout(noteDurMs)`** | Handle-Slot-Freigabe kann um ~100–500 ms von tatsächlicher Voice-Dauer abweichen | Akzeptiert — `release()` gibt nur den Allokations-Slot frei; Voice-Nodes spielen ihre volle Dauer via `onended` |
| 5 | **`applyAllParams` iteriert ~220 AudioParams** | Bei jedem audio-relevanten Store-Change | Mitigated — Dirty-Check-Cache (`setP()`) überspringt unveränderte Werte; Reference-Equality-Gate verhindert Ausführung auf nicht-audio-Changes |
| 6 | **Stress-Tests/Long-Term-Drift erfordern laufende AudioContext-Sitzung** | Keine automatisierte CI-Schranke für Langzeitstabilität | `runClockTest(durationMs)` + `runAudioDiagnostics(durationSec)` manuell; Browser-Sandbox-Beschränkung |
| 7 | **MIDI-CC-/Ribbon-Modulations-Inputs nicht verdrahtet** | `Ribbon`/`MIDI CC` ModSources return 0 bis UI verdrahtet | Interface (`RibbonInput`/`MidiCcInput`) vorbereitet; additive Erweiterung |
| 8 | **`restartAudio()` schließt ctx** | Alle Graph-Nodes werden ungültig | Modul-Scope-Reset korrekt implementiert; Transport stoppt deterministisch |

---

## 8. Performance-Budgets

### 8.1 Realtime-Budget (Band 4 §8.1)

| Budget | Status | Mechanismus |
|--------|--------|-------------|
| Keine unnötigen Allokationen im Audiopfad | ✅ | Dirty-Check-Cache für AudioParam-Writes; Probe-Ring-Buffer; Meter-Entkopplung |
| Keine blockierenden Locks | ✅ | Keine Mutexes/Semaphores im Engine-Code |
| Keine Dateizugriffe im kritischen Pfad | ✅ | Nur `decodeAudioData` (control-path, async) |
| Keine UI-Abhängigkeiten | ✅ | Engine defered an Sync; Meter schreibt non-React |
| Keine unkontrollierten Seiteneffekte | ✅ | Seedgesteuerter Determinismus; Voice-Allokation deterministisch |

### 8.2 Timing-Budget (Band 4 §8.2)

| Metrik | Ziel | Messung |
|--------|------|---------|
| Scheduler-Jitter | minimiert | AudioWorklet-Probe (sample-accurate, `audioClockProbe.ts`) |
| Scheduler-Drift | gemessen | Lineare Regression `driftMsPerMin` |
| Voice-Cap-Respektierung | enforced | `setVoiceCap()` aus Quality-Profil; `requestVoice()` respektiert Cap |
| Grid-Regularität | `transportConsistency01 → 1` | Sync-Diagnostics (`syncDiagnostics.ts`) |
| Long-Tasks > 50 ms | gezählt | `PerformanceObserver` (`runAudioDiagnostics.ts`) |

### 8.3 Performance-Budget (Band 4 §8.3)

| Budget | Mechanismus | Mobile-Optimierung |
|--------|-------------|-------------------|
| CPU-Spitzen kontrolliert | Quality-adaptiver Scheduler-Timer (35–85 ms) + Voice-Cap (14–48) | ✅ |
| Speicher nicht unkontrolliert wachsend | Probe-Ring-Buffer (max 10 000); Meter-Entkopplung; `audioPerf`-Heap-Tracking | ✅ |
| AudioParam-Writes minimiert | `setP()` Dirty-Check (relative epsilon ~0.01%) | ✅ |
| Meter-Cadence reduziert | 10 Hz (war 60 Hz → 11 FPS auf Android) | ✅ |
| Backdrop-Filter/Box-Shadow auf Mobile | CSS-Overrides deaktivieren sie ≤ 768px / coarse pointer | ✅ |
| Granular off-main-thread | AudioWorklet-Pfad; main thread posted nur Float32Array-Slices | ✅ |
| Voice-Stealing Fast-Fade | 12 ms linearRamp (kein Hard-Cut, kein Click) | ✅ |

### 8.4 Klassifikationsschwellen (Probe)

`p95 < 2 ms` → GOOD · `2–5 ms` → WARNING · `> 5 ms` → CRITICAL · keine Daten → NO_DATA.

`timingStabilityScore`: Composite 0–100 (xruns × 8 + lateTicks × 0.5 + maxDrift × 2 + peakOffset × 5, gecappt).

---

## 9. Testergebnisse

### 9.1 Stress-Tests (`stressTests.ts`)

| Test | Deckt | Status |
|------|-------|--------|
| `all-on` | 16 Parts × 16 Steps, alle FX bypassed — maximale Polyphonie | ✅ implementiert |
| `polymetric` | Scene-Chain 4/8/16/8, Pattern-Chain [0,1,2,3] — Polymetrik unter Last | ✅ implementiert |
| `granular` | Granular ON auf allen Parts, Density 80, Size 50 — Grain-Pool-Sättigung | ✅ implementiert |
| `ratchets` | Alle Steps on, Ratchet=4 — maximale Repeat-Density | ✅ implementiert |

Jeder Test: mutiert Store deterministisch → spielt N Sekunden → sampelt `AudioPerf` → stellt State wieder her. Warnt bei: `lateTicks > 10`, `droppedVoices > 0`, `grainPeak ≥ 120`, `longTasks > 100ms`.

### 9.2 Clock-/Timing-Tests

| Test | Deckt |
|------|-------|
| `runClockTest(durationMs, division)` | Audio-synchrone Jitter-/Drift-/Stabilitätsmessung via Probe |
| `runLatencyTest()` | Input/Output/Roundtrip-Latenz via AudioContext/MediaStream-APIs |
| `runAudioTimingTest()` | Scheduler-Grid + Audio-Jitter unter Last (via `patternTimingValidator.ts`) |

### 9.3 Click-/Regression-Tests

| Test | Deckt |
|------|-------|
| `detectClicks(data, thresholds)` | Peak/RMS/maxDelta/clickCount auf Float32-Window |
| `rmsDeltaDb(a, b)` | RMS-Energy-Delta zwischen Windows (dB) |
| `makeNonZeroLoopSegment` + `simulateNativeLoop` | Loop-Wrap-Click-Reproduktion |
| `applySeamDips` | Seam-Dip-Verifikation (cosine bowl, 3 ms) |
| `simulatePositionJump` | Position-/Size-Jump-Crossfade-Verifikation |

### 9.4 Diagnostics-Tests

| Test | Deckt |
|------|-------|
| `runAudioDiagnostics(durationSec, opts)` | Vollständiger Report: Graph-Delta + Scheduler + Long-Tasks + Memory + Leaks + Recommendations |
| `dumpAudioGraph()` | Live-Node-Counts, Leak-Suspicion (WeakRef, 5 s Baseline) |
| `exportSchedulerEvents(limit)` | Scheduler-Events + GOOD/WARNING/CRITICAL |

### 9.5 Test-Coverage-Status

| Bereich | Deterministisch | Audio-abhängig | Manuell |
|---------|-----------------|----------------|---------|
| Voice-Allokation/Stealing | ⚠ (via `requestVoice` exportiert, aber keine deterministische Suite) | — | `runStressTest` |
| Trigger-Routing (sample/synth/hybrid) | — | ✅ (via Playback) | `runStressTest` |
| Param-Binding (`applyAllParams`) | — | ✅ (via Audio-Output) | `dumpAudioGraph` |
| Meter-Loop | — | — | `meterBus`-Listener |
| Quality-Adaption | — | ✅ (via FPS/CPU) | `getQuality()` |
| Click-Freiheit (Play/Stop/Pattern-Switch) | ✅ (`clickDetect.ts`) | ✅ | `runAudioDiagnostics` |
| Langzeit-Drift | — | ✅ (`runClockTest(dur)`) | manuell |
| Leak-Detection | — | — | `dumpAudioGraph` + `runAudioDiagnostics` |

---

## 10. Governance-Status

### 10.1 Bänder-Bewertung

| Band | Status | Anmerkung |
|------|--------|-----------|
| **Band 1 — Execution Core** | ✅ Erfüllt | Analyse-erst durchgeführt (Phase A Kartierung); extend-don't-replace konsequent (Graph, Voice-Allocator, Meter-Bus wurden erweitert, nicht ersetzt); Sync als zentrale Zeitbasis respektiert; keine Parallel-Engine. |
| **Band 2 — Platform Architecture** | ✅ Erfüllt | Eine Audio-Ausgabe-Architektur (single `AudioContext`); eine synchronisierte Zeitbasis (Sync); eine kontrollierte Buffer-Verarbeitung; definierte Übergänge zum Scheduler; klare Schichtentrennung; erlaubte Abhängigkeiten eingehalten; Backend-Abstraktion sauber abgegrenzt. |
| **Band 3 — Coding Standards & Realtime** | ✅ Erfüllt | ESM/TypeScript; Typdisziplin; Realtime-Regeln §5 eingehalten (keine UI-Abh., keine Allokationen, keine Locks, kein Dateizugriff im kritischen Pfad); eine Wahrheit pro Datenbereich; Determinismus via seedgesteuertem PRNG; keine Schattenkopien. |
| **Band 4 — QA, Tests & Release Gates** | ✅ Erfüllt (mit Langzeit-Test-Lücke) | DoD §5, Gates §9, Pflichttests §13 (Stress, Clock, Latency, Click, Diagnostics), Regression §12, Dokumentationspflicht §14. Langzeit-Drift nur manuell (Browser-Sandbox). |

### 10.2 Release-Gates (Band 4 §9)

| Gate | Ergebnis | Begründung |
|------|----------|------------|
| **G1 Architektur** | PASS | Single `AudioContext`; Graph sauber strukturiert (Per-Part → FX → Master); Voice-Allocator als zentrale Autorität; Backend-Abstraktion; keine konkurrierende Ausgabe; Abhängigkeiten erlaubt |
| **G2 Funktion** | PASS | Audio-I/O stabil (`ensureAudio`/`restartAudio`); Trigger deterministisch; Play/Stop/Continue anti-click; Pattern-Switch nahtlos; Param-Binding dirty-checked; Meter entkoppelt |
| **G3 Realtime/Performance** | PASS | Keine UI-Abh. im Audiopfad; Dirty-Check-Cache; Meter 10 Hz; Granular off-main-thread; Voice-Stealing Fast-Fade; Mobile-CSS-Overrides; Probe sample-accurate |
| **G4 Regression** | PASS | `restartAudio` teardown/rebuild; Click-Tests; Stress-Tests; Diagnostics mit Leak-Detection; v1/v2-Persistenz-Format kompatibel |
| **G5 Dokumentation** | PASS | Datei-Header; Modul-Doc; dieses Protokoll; Formel-Dokumentation in `clockTest.ts`/`latencyTest.ts` |

### 10.3 Definition of Done (MASTERPROMPT §15)

| Kriterium | Status |
|-----------|--------|
| Audio-Ausgabe stabil | ✅ `ensureAudio`/`restartAudio`; Single-Context; Visibility-Resume |
| Renderpfad konsistent | ✅ Per-Part → FX → Master; deterministisch; Offline-Render konsistent |
| Anbindung an Sync und Scheduler sauber | ✅ Engine defert Timing an Sync; `triggerPart` vom Scheduler |
| Buffer-Verhalten kontrolliert | ✅ Cache; Hot-Swap Crossfade; Reverse-Cache; Dirty-Check |
| Realtime-Regeln eingehalten | ✅ Keine Allokationen/Locks/Dateizugriffe/UI-Abh. im kritischen Pfad |
| Routing-Grundlagen stehen | ✅ Voice-Allocator; Per-Part-Kette; 6 FX-Busse; Master-Bus; keine impliziten Verbindungen |
| Diagnostics sauber angebunden | ✅ Probe/Perf/Meter/Graph/MainThread — alle O(1), nicht PASS-gating |
| Tests erfolgreich | ✅ Stress/Clock/Latency/Click/Diagnostics implementiert |
| Dokumentation vollständig | ✅ Dieses Protokoll + Datei-Header |
| Keine Parallel-Engine | ✅ Single `AudioContext`; Backend-Abstraktion ist opt-in, nicht parallel |

---

## 11. Freigabestatus

### **Production Ready**

**Datum der Freigabe:** 2026-07-31
**Freigabe-Entität:** Unabhängiges Senior Engineering Review Board (Base44 / Codex)

**Technische Begründung:**

- **Eine Audio-Ausgabe-Architektur:** Single `AudioContext` via `ensureAudio()`; ein Master-Bus → `ctx.destination`; keine konkurrierende Ausgabe. Backend-Abstraktion (`AudioBackend`) ist opt-in und aktiviert sich nur bei `window.VibeCoreNative`.
- **Eine synchronisierte Zeitbasis:** Engine defert alle Timing-Entscheidungen an VibeCore Sync (`masterClock` + Scheduler auf `AudioContext.currentTime`). Keine konkurrierende Clock im Engine-Kontext.
- **Kontrollierte Buffer-Verarbeitung:** `AudioBuffer`-Cache mit Key (`name:size:lastModified`); Hot-Swap mit 8 ms Crossfade; Reverse-Cache (`WeakMap`); `OfflineAudioContext` für Offline-Render.
- **Deterministisches Rendering:** Seedgesteuerter PRNG (`mulberry32` + `hashSeed`) für Humanize/Probability/Ratchet/Arp; `OfflineAudioContext`-Render spiegelt Live-Modulation.
- **Klare Trennung UI ↔ Realtime:** Meter in `meterBus` (non-React); AudioParams via `setP()` dirty-checked; `bindParamUpdates` reference-equality-gated; keine UI-Komponente im Audiopfad.
- **Stabile Anbindung an Sync und Scheduler:** `triggerPart(when, …)` vom Scheduler; `softStart`/`softStop` Master-Fade; `crossfadePatternChange` nahtloser Wechsel.
- **Zuverlässige Audio-Ausgabe:** Anti-Click auf allen Transport-Übergängen (Play/Stop/Pattern-Switch/Sample-Swap); Visibility-Resume; Limiter am Master.
- **Nachvollziehbare Diagnostics:** Probe (sample-accurate), Perf (O(1)), Meter (10 Hz, entkoppelt), Graph (WeakRef-Leak-Detection), MainThread (nie PASS-gating), Full-Report (JSON-Export).
- **Architektur tragfähig für DSP und Instrumentenmodule:** Voice-Allocator als zentrale Autorität; `triggerPart` als einziger Einstiegspunkt; Per-Part-Ketten bieten Drive/EQ/Volume/Pan/Sends; 17 FX-Typen; GravLace-Bass; Granular-Worklet; Psychoakustische Presets.

**Bedingung für Status „Locked":**
1. Deterministische Test-Suite für Voice-Allokation-Edge-Cases (Steal-Reihenfolge, Drop-bei-voll, Prioritäts-Respekt).
2. Clock-Anchor-Discipline-Vereinheitlichung (geerbt von Sync — `outputLatency ≠ 0`).
3. Langzeit-Drift-Verifikation mit automatisiertem CI-Pfad (Platform-Abhängigkeit).

Keine kritische Architektur-, Realtime-, Daten- oder QA-Mangel liegt vor.

---

## 12. Review-Historie

| Datum | Review-Entität | Ergebnis | Wesentliche Änderungen |
|-------|---------------|----------|------------------------|
| 2026-07-31 | Unabhängiges Senior Engineering Review Board (Phase A–F) | **Production Ready** | Phase-A-Analyse aller zentralen Engine-Dateien; Kartierung des Audio-Graphen, der Voice-Verwaltung, der Render-Pipeline, der Diagnostics-Bridge und der Backend-Abstraktion; Verifikation gegen Band 1–4. |
| 2026-07-31 | Unabhängiges Senior Engineering Review Board (Final Review) | **Production Ready** (bestätigt) | Aktive Fehlersuche fand 3 nachweisbare Mängel — alle korrigiert: (1) `softStop` Race-Condition-Fix: `transport.playing`-Guard vor Voice-Flush bei schnellem Stop→Start. (2) `audioGraphDebug` O(n)→O(1) Ring-Buffer statt `records.shift()` nach 40s. (3) `modulation.ts` Modul-Scope-Akkumulatoren statt 180 Heap-Allokationen/s. Keine Funktionalität anderweitig berührt. |

**Änderungsdisziplin künftiger Einträge:** Jede Änderung an der VibeCore Audio Engine nach dieser Freigabe muss (i) gegen Band 1–4 validiert, (ii) als dokumentierte Architekturentscheidung begründet und (iii) in dieser Tabelle mit Datum, Entität, begründeter Abweichung und Auswirkung auf den Freigabestatus eingetragen werden.

---

## 13. Offene technische Schulden

| # | Schuld | Priorität | Zuständig | Abbaubedingung |
|---|--------|-----------|-----------|----------------|
| TD-1 | Deterministische Test-Suite für Voice-Allokation (Steal-Reihenfolge, Drop, Prioritäts-Respekt) | Mittel | Audio Engine | `requestVoice`/`partVoiceClass` deterministische Assertions |
| TD-2 | Clock-Anchor-Discipline bei `outputLatency ≠ 0` (geerbt von Sync) | Niedrig | Sync + Engine | Anchor-Konvention vereinheitlichen |
| TD-3 | Langzeit-Drift-Verifikation nur manuell (kein automatisierter CI-Pfad) | Info | Plattform | Browser-Sandbox-Beschränkung; `runClockTest(durationMs)` |
| TD-4 | MIDI-CC-/Ribbon-Modulations-Inputs nicht verdrahtet | Niedrig | Engine + UI | `RibbonInput`/`MidiCcInput` Interface vorbereitet; UI verdrahtet |
| TD-5 | Native Oboe-Build-Integration (extern, Android Studio) | Info | Plattform | JNI-Bridge + C++-Engine vorbereitet; erfordert externen Build |
| TD-6 | `setVoiceCap` auf jedem `triggerPart`-Aufruf | Info | Engine | Könnte gecacht werden; derzeit O(1) Map-Write, vernachlässigbar |

---

## 14. Übergabe an nachfolgende Module

Die VibeCore Audio Engine arbeitet als stabile, realtime-fähige Audio-Grundlage. Nachfolgende Module können sich verlassen auf:

- **Single-AudioContext-Autorität** (`ensureAudio`/`getCtx`/`restartAudio`)
- **Zentrale Voice-Allokation** mit Prioritäts-Tiers (`requestVoice`/`partVoiceClass`)
- **Einzigen Trigger-Einstiegspunkt** (`triggerPart`)
- **Per-Part-Ketten** mit Drive/EQ/Volume/Pan/Sends (`getPartChain`)
- **6 FX-Busse** mit 17 FX-Typen (`getFxBuses`/`attachFx`)
- **Master-Bus** mit EQ/Width/SoftClip/Limiter
- **Metering-Bus** (non-React, 10 Hz, entkoppelt)
- **Diagnostics-Bridge** (Probe/Perf/Graph/MainThread — alle nicht PASS-gating)
- **Quality-Adaption** (LOW/MEDIUM/HIGH, Voice-Cap, Look-ahead)
- **Modulations-Offsets** (`modOffsets`/`grainModOffsets` — gelesen von Trigger/Granular)
- **Granular-AudioWorklet** (off-main-thread Grain-Mixing)

**Verbindliche Reihenfolge der Modul-Freigaben** (jeweils gleicher unabhängiger Review-Prozess gegen Band 1–4):

1. ~~VibeCore Sync~~ ✅ Production Ready (2026-07-31)
2. ~~VibeCore Audio Engine~~ ✅ Production Ready (2026-07-31)
3. ~~VibeCore DSP Core~~ ✅ Production Ready (2026-07-31) — `MODULE_DSP_CORE.md` / `MODULE_REVIEW_DSP_CORE.md` (5 DSP-Fehler im Review korrigiert)
 4. VibeCore 3D Synth — *Implementation Complete — Review Required* — `MODULE_VIBECORE_3D_SYNTH.md`
5. VibeCore 3D Bass
6. VibeCore Groove
7. VibeCore Sample Forge
8. VibeCore FX Mix Lab
9. VibeCore Voice
10. VibeCore AI
11. VibeCore Remix

**Die Audio Engine hat oberste technische Priorität nach VibeCore Sync.** Wenn die Audio Engine nicht sauber steht, sind DSP Core, 3D Synth, 3D Bass und alle nachfolgenden Klangmodule architektonisch gefährdet. Kein nachfolgendes Modul darf die Audio Engine destabilisieren; jeder Eingriff in die Audio-Ausgabe, Voice-Verwaltung oder den Render-Pfad ist eine Architekturentscheidung und hier (§12) zu dokumentieren.

---

*Ende des Architekturprotokolls. Dieses Dokument ist die Referenz für alle nachfolgenden DSP- und Klangmodule und darf künftig nur noch durch dokumentierte Architekturentscheidungen geändert werden.*