# MODULE — VibeCore Sync

**VibeCoreLiv3 · Core Timing, Transport, Scheduler & Synchronisation**
**Bezug:** MASTERPROMPT – VibeCore Sync · Band 1–4 · **Status:** Production Ready · **Stand:** 2026-07-31

VibeCore Sync ist die zentrale Zeit-, Transport- und Synchronisationsinstanz der gesamten Plattform. Dieses Dokument kartiert den vorhandenen Stand, die in diesem Arbeitsband geschlossenen Lücken, die Architektur, Tests und den DoD-Status.

---

## 1. Ausgangslage (Phase A — Analyse)

Vor diesem Arbeitsband existierten bereits tragfähige Sync-Komponenten:

| Komponente | Datei | Zustand |
|------------|-------|---------|
| Master Clock | `src/lib/clock/masterClock.ts` | Single timebase (`AudioContext.currentTime`), phasenstabil, output-latency-kompensiert, Transport-Hold/Start, Downbeat-Align, source-agnostisch, rAF-Subscriber |
| Clock-Types | `src/lib/clock/types.ts` | `ClockState`, `ClockSource`, `Division` |
| Divisions | `src/lib/clock/divisions.ts` | phasenstabile Divisions-Mathematik |
| Tap-Tempo | `src/lib/clock/tapTempo.ts` | pure Median-Schätzung |
| Internal Source | `src/lib/clock/sources/internalSource.ts` | bridged `store.bpm` → MasterClock, registriert Output-Latenz |
| External Stubs | `src/lib/clock/sources/externalStubs.ts` | MIDI/Link **Phase-4-Stub (no-op)** |
| Adaptive Sync | `src/lib/sync/adaptiveSync.ts` | spektrale Fluss-Onset-Erkennung, Autokorrelation-Tempo, PLL-Phasenlock, routed BPM über Store |
| Scheduler | `src/lib/audio/scheduler.ts` | Look-ahead, AudioContext-Grid, Pattern/Scene/Step, Swing/Humanize/Probability/Ratchet, Arp, Playhead-Publishing, Quality-adaptiver Timer, grid-aligned Pattern-Switch |
| AudioClockProbe | `src/lib/audio/audioClockProbe.ts` | AudioWorklet-Probe (sample-accurate), SP-Fallback, Jitter/Drift/Stability/Late/Xrun, Event-Summary-Klassifikation |
| ClockTest / LatencyTest | `src/lib/setup/clockTest.ts`, `latencyTest.ts` | Diagnostik-Einstiegspunkte |

**Identifizierte Lücken gegen Band 4 §6.1 (DoD Sync):**
1. **Start/Stop/Continue:** nur Start-from-0 + Stop-freeze; kein Continue/Resume aus gehaltener Position.
2. **Song Position:** `globalTick` resetete bei jedem Pattern-Wechsel → keine monotone Song-Position.
3. **Quantise-Grid / quantisierte Übergänge:** nur `chainMode` (IMMEDIATE/BOUNDARY) am Pattern-Ende; keine allgemeine Quantise-Grid-Einstellung.
4. **Jump/Seek:** kein expliziter, deterministischer Seek an eine beliebige Position.
5. **Externe Sync (MIDI):** MIDI/Link waren no-op-Stubs; kein `syncStatus` im Transport; kein External-Sync-Mode-Feld.
6. **Transport-Konsistenz / Langzeit-Drift:** Jitter/Drift gemessen, aber keine Transport-Konsistenz-Metrik, kein Langzeit-Test-Einstiegspunkt.
7. **Sync-Test-Suite:** Clock-/Latenz-Tests existierten, aber keine Transport-/Continue-/Quantise-/Song-Position-Tests.

---

## 2. Geschlossene Lücken (Phase B–F)

### Phase B — Kern konsolidieren
- **Continue/Resume (Band 4 §6.1 Start/Stop/Continue):** `TransportState.held` (transient) speichert die Position beim Pause; `stopScheduler` captured sie (Beat aus MasterClock, step/sceneIdx/songTicks); `startScheduler` resume aus `held` (Re-Anchor auf gleichem Grid + `masterClock.startTransportPhase(now, held.beat)`) oder startet von 0. `togglePlay` ist die einzelne Play/Pause-Aktion (Pause → held; Play → Continue aus held oder Start von 0). `resetTransport` setzt `rewind` → `stopScheduler` verwirft held und nullt die Position.
- **Monotone Song-Position:** neuer Scheduler-Lokal `songTicks` (16tel-Noten), inkrementiert pro Tick, **nie** bei Pattern-Wechsel resetet, nur bei Start-von-0/Stop. Exposed via `playheads.songTicks` (throttled Slice → keine Transport-Re-Renders). Beat-Phase bei Seek = `songTicks/4` (Quarter-Notes) → Phasenkontinuität bleibt erhalten.

### Phase C — Scheduler härten
- **Quantise-Grid:** `TransportState.quantizeGrid` (`off`|`1/16`|`1/8`|`1/4`|`1`, persisted). `quantizeStepsForGrid()` in `divisions.ts` (pure) mappt auf Step-Anzahl. Der Scheduler queued Pattern-Switches und Seeks nur an Grid-Boundaries (wenn `quantizeGrid ≠ off`); bei `off` verhält sich `chainMode` wie bisher (Backward-kompatibel, Band 3 §10.3).
- **Quantised Seek:** `seekTo(sceneIdx, step)` setzt `pendingSeek`; `applySeekNow()` re-anchort `nextTickTime` + Clock + stepInScene/sceneIdx deterministisch an der nächsten Quantise-Boundary (oder sofort bei `off`).

### Phase D — External Sync
- **MIDI Clock Receiver (Web MIDI):** neues `src/lib/clock/sources/midiSync.ts` ersetzt den Stub. Empfängt 24-PPQ Clock (0xF8 → Tempo-Schätzung + Phasenlock), Start (0xFA → Start von 0), Continue (0xFB → Resume), Stop (0xFC → Pause), Song Position Pointer (0xF2 → coarse Seek in 16tel). Transport-Befehle routen über Store-Actions → Single-Scheduler bleibt die einzige Timing-Authority. `externalStubs.ts` re-exportiert `midiSource` unter dem bestehenden Interface (kein Import-Bruch).
- **syncStatus:** `TransportState.syncStatus` (transient) mirrored Source, Confidence, externalActive, midiConnected, error. `setSyncStatus()`-Action.
- **Grenze dokumentiert (Band 4 §6.1/§15):** Web MIDI nicht auf allen UAs verfügbar (z.B. iOS Safari ohne Polyfill); `startMidiSync` resolved zu `unavailable`, interne Clock bleibt Authority. Keine konkurrierende Zeitbasis.

### Phase E — Diagnostics
- **Sync-Diagnostics:** neues `src/lib/sync/syncDiagnostics.ts` mit `snapshotSyncDiagnostics()` → Jitter, Drift/min, Stability, Late/Xrun, Klassifikation (GOOD/WARNING/CRITICAL/NO_DATA) und **Transport-Konsistenz** (Regularität des geplanten Step-Grids: Anteil auf-der-Grid liegender Inter-Event-Intervalle, 1-ms-Toleranz).

### Phase F — Tests & Freigabe
- **Sync-Self-Test-Suite:** neues `src/lib/sync/syncSelfTest.ts` → `window.runSyncTests()`. Deterministische, UI-unabhängige Tests für Store-Transport-Actions (Start/Stop/Continue, Rewind, Quantise, Seek, syncStatus), MasterClock-Phasenmathematik (Re-Anchor preserves beat, Latenz-Kompensation), Tap-Tempo-Median, Quantise-Grid-Mapping. Audio-abhängige Tests (Drift, Continue-under-live-AudioContext) bleiben bei `runClockTest`/`runAudioTimingTest` (Band 4 §11.3 — Tests werden nicht zur Architektur).

---

## 3. Architektur (Band 2 §6.1 — eine globale Zeitbasis)

- **Single source of truth = `AudioContext.currentTime`.** `setInterval` weckt nur den Scheduler; das Beat-Grid wird durch `nextTickTime` (Audio-Zeitstempel) + monotonen `globalTick`/`songTicks`-Zähler getrieben.
- **MasterClock** ist die einzige Systemzeit; alle Module richten sich danach aus. Keine konkurrierenden Clocks, keine lokalen Ersatz-Taktgeber (Band 4 §16).
- **Trennung Timing ⟂ Darstellung:** UI setzt Parameter (Tempo, Transport, Quantise) und liest `playheads` (throttled) — definiert niemals die Timing-Quelle (Band 4 §6.4).
- **Erlaubte Deps (Band 4 §8):** Sync → Groove/Synth/Bass/SampleForge/FX/Voice/Remix/Diagnostics/State. Verboten: umgekehrte Manipulation, UI als Timing-Quelle, DSP erzeugt Zeit als Nebenwirkung, externe Zeitinseln.
- **Realtime-Sicherheit (Band 3 §5):** keine Allokationen/Locks/Dateizugriffe/UI-Abhängigkeiten im Audiopfad; seedgesteuerter Determinismus (`mulberry32`+`hashSeed`); `triggerPart`-Wertübergabe.

---

## 4. DoD-Status (Band 4 §15)

| Kriterium | Status |
|-----------|--------|
| Clock stabil | ✅ single timebase, phasenstabil, latency-kompensiert |
| Transport sauber (Start/Stop/Continue) | ✅ Continue via `held` + Smart `togglePlay` + `rewind` |
| Song-/Pattern-/Scene-Positionen korrekt | ✅ monotone `songTicks` + deterministischer Seek |
| Scheduler deterministisch | ✅ Look-ahead, AudioContext-Grid, seedgesteuert |
| Quantisierung korrekt | ✅ `quantizeGrid` + `quantizeStepsForGrid` + Grid-Boundary-Applikation |
| Externe Sync sauber integriert **oder abgegrenzt** | ✅ Web-MIDI-Receiver real + dokumentierte Grenze (UA-Verfügbarkeit) |
| Timing-Tests bestanden | ✅ `runSyncTests` (deterministisch) + `runClockTest`/`runAudioTimingTest` (audio) |
| Realtime-Regeln eingehalten | ✅ keine UI-Abh. im Audiopfad, keine Allokationen |
| Dokumentation vollständig | ✅ dieses Dokument + Datei-Header |
| Keine konkurrierende Zeitbasis | ✅ Song-Position aus selbem AudioContext-Grid abgeleitet |

**Reifegrad (Band 4 §10): Production Ready.**

---

## 5. Risiken (Band 4 §14)

- **Web-MIDI-Verfügbarkeit:** nicht auf allen UAs → dokumentierte Grenze, interne Clock-Authority bleibt.
- **Resume-Re-Anchor-Lücke (~50 ms):** Continue re-anchort `nextTickTime` auf `currentTime + 0.05` → minimaler Gap beim Resume (akzeptabel, Standard-DAW-Verhalten).
- **SPP cross-pattern:** Song-Position-Pointer-Mapping ist auf das aktuelle Pattern begrenzt (cross-pattern SPP out of scope für dieses Arbeitsband).
- **Langzeit-Drift:** `driftMsPerMin` wird durch Regression im Probe gepflegt; ein echter Langzeit-Test über Minuten erfordert eine laufende AudioContext-Sitzung (`runClockTest(durationMs)`).

---

## 6. Test-Einstiegspunkte

| Test | Aufruf | Deckt |
|------|--------|-------|
| Sync-Self-Test | `window.runSyncTests()` | Store-Transport, Clock-Phase, Tap-Tempo, Quantise-Mapping |
| Clock-Test | `window.runClockTest?.()` / `runClockTest(durationMs)` (setup) | Jitter/Drift/Stability/Late |
| Timing-Validator | `window.runAudioTimingTest()` | Scheduler-Grid, Audio-Jitter, Drift, Stabilität unter Last |
| Sync-Diagnostics | `snapshotSyncDiagnostics()` | Jitter/Drift/Konsistenz-Snapshot |
| Latency-Test | `runLatencyTest()` | Input/Output/Roundtrip-Latenz |

---

## 7. Übergabe

VibeCore Sync arbeitet als verlässliche, zentrale Zeitinstanz. Die nachfolgenden Module (Groove, 3D Synth, 3D Bass, FX Mix Lab, Sample Forge, Voice, AI, Remix) können sich auf die Single-Clock-Authority, den deterministischen Transport (Start/Stop/Continue), die monotone Song-Position und quantisierte Übergänge verlassen. Sync hat Priorität vor allen kreativen/klanglichen Erweiterungen (Band 4 §19).

**Freigabestand der Modul-Reihe (Stand 2026-07-31):**

1. ~~VibeCore Sync~~ ✅ **Production Ready** — `MODULE_REVIEW_SYNC.md` (Architekturprotokoll)
2. ~~VibeCore Audio Engine~~ ✅ **Production Ready** — `MODULE_AUDIO_ENGINE.md` (Architekturprotokoll)
3. ~~VibeCore DSP Core~~ ✅ **Production Ready** — `MODULE_DSP_CORE.md` / `MODULE_REVIEW_DSP_CORE.md` (Review: 5 DSP-Fehler korrigiert)
4. ~~VibeCore 3D Synth~~ ✅ **Production Ready** — `MODULE_REVIEW_VIBECORE_3D_SYNTH.md`
5. **VibeCore 3D Bass** — *freigegeben zur Implementierung*
6. VibeCore Groove
7. VibeCore Sample Forge
8. VibeCore FX Mix Lab
9. VibeCore Voice
10. VibeCore AI
11. VibeCore Remix