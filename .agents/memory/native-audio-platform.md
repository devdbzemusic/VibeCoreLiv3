---
name: Native Audio Platform
description: Phase build order, architecture invariants, Oboe engine, Sync, Groove — what must be preserved across all edits
---

## Phase Status

| Phase | Name | Status |
|-------|------|--------|
| Phase 1 | Oboe Native Audio Foundation | ✅ COMPLETE |
| Phase 2 | VibeCore Sync (PPQ 1920) | ✅ COMPLETE |
| Phase 3 | VibeCore Groove Engine | ✅ COMPLETE |
| Phase 4 | 3D Bass Module | NEXT |

---

## Architecture Invariants (enforce across all edits)

1. **ONE Oboe engine** — `VibeCoreAudioEngine` singleton. Never create a second stream.
2. **ONE global clock** — `VibeCoreSync`. No module has its own clock/scheduler/timer.
3. **Zero heap allocation on Audio Thread** — All arrays fixed-size; all commands via queues.
4. **Zero locks on Audio Thread** — All cross-thread state via `AudioThreadSafeQueue<T, N>`.
5. **MusicalPosition is derived from absoluteSamplePos** — never from system time.
6. **All AudioNode timing events carry `sampleOffset`** — sample-accurate, not buffer-late.

---

## Key Files

### Phase 1 — Foundation
- `platform/VibeCoreAudioEngine.h/.cpp` — owns Sync + Graph, Oboe callbacks
- `platform/AudioDeviceManager.h/.cpp` — device capability query + hotplug
- `platform/AudioSessionManager.h/.cpp` — AudioFocus state machine
- `platform/PerformanceMonitor.h/.cpp` — latency + CPU tracking
- `platform/Diagnostics.h/.cpp` — structured DiagnosticReport
- `graph/AudioNode.h` — abstract base + 7 timing callbacks
- `graph/AudioBus.h` — fixed-size float32 bus
- `graph/AudioGraphManager.h/.cpp` — DAG topology + dispatchSyncEvents
- `graph/MixerNode.h/.cpp` — N-input summing mixer
- `threads/ThreadModel.h/.cpp` — 5-thread contract
- `threads/AudioThreadSafeQueue.h` — lock-free SPSC, must be power-of-2 capacity, T must be trivially copyable

### Phase 2 — Sync
- `platform/sync/MusicalPosition.h` — PPQ=1920, `fromTick()` calculator
- `platform/sync/TickEvent.h` — TickEvent + TickEventBuffer (stack, 64 slots)
- `platform/sync/SyncCommand.h` — trivially copyable commands to sync engine
- `platform/sync/VibeCoreSync.h/.cpp` — Transport, Tempo, Timeline, Loop, Scheduler
- `docs/adr/ADR-006-timing-architecture.md`

### Phase 3 — Groove
- `groove/GrooveTypes.h` — Step, Pattern, Track, Scene, Chain, Voice, SampleBuffer, Trigger
- `groove/GrooveCommands.h` — 35 command types, 40 bytes, trivially copyable
- `groove/TriggerQueue.h` — 256-slot callback-internal trigger ring
- `groove/VoicePool.h/.cpp` — 64 voices, Q16.16 pitch, choke groups, deterministic stealing
- `groove/StepSequencer.h/.cpp` — Swing, Humanize, Probability, Roll, Flam, Micro Timing
- `groove/PianoRoll.h/.cpp` — sorted scan, loop-safe, all 4 track modes
- `groove/SceneEngine.h/.cpp` — 32 scenes, chain, bar-synced switch
- `groove/GrooveNode.h/.cpp` — AudioNode subclass, 16 tracks
- `groove/GrooveEngine.h/.cpp` — UI API, UndoStack (64 depth), Copy/Paste

### Bridge
- `bridge/jni_bridge.cpp` — JNI marshalling only (Phase 1+2+3)
- `NativeAudioBridge.kt` — Kotlin @JavascriptInterface, Phase 1+2+3

---

## ADRs
- ADR-001: Oboe as single engine (ACCEPTED)
- ADR-002: Five-thread model + lock-free SPSC (ACCEPTED)
- ADR-003: DAG audio graph (ACCEPTED)
- ADR-004: Pre-allocate everything, zero allocs on Audio Thread (ACCEPTED)
- ADR-005: Module boundaries + WebView bridge (ACCEPTED/OPEN)
- ADR-006: Single global clock, PPQ 1920, sample-accurate (ACCEPTED)

---

## Phase 3 — Groove Timing Formula

```
1/16-Step = 480 ticks (PPQ 1920 / 4)
16 steps  = 7680 ticks = 1 bar

onTick():  if absoluteTick >= nextStepTick → fire step, nextStepTick += stepSize
Swing:     odd steps: nextStepTick += swing * stepSize / 100
Humanize:  ±humanize * stepSize / 200 ticks (xorshift32)
Roll:      mRoll.active, hitsLeft, nextRollTick += spacingTicks
```

---

## Open Risks (post-Phase 3)

| # | Risk | Severity |
|---|------|----------|
| R-S1 | Double-precision drift >24h session | LOW |
| R-G1 | UI-Thread mirror for Undo/Redo not yet implemented | MEDIUM |
| R-G2 | Copy/Paste clipboard reads from UI mirror (stub only) | MEDIUM |
| R-G3 | Per-track volume scaling in VoicePool::trigger() missing | LOW |
| R-G5 | Legacy vibecore_engine.cpp must be deleted before first build | HIGH |

---

## Phase 4 — 3D Bass (NEXT)

**Why:**
- Phase 3 proves the AudioNode + Sync + PianoRoll pipeline
- 3D Bass is a second AudioNode (Oscillator + Waveshaper instead of SampleBuffer playback)
- Needs note events from PianoRoll (already implemented in Phase 3)

**Build:**
1. `bass/BassOscillator.h/.cpp` — wavetable oscillator, no malloc
2. `bass/BassNode.h/.cpp` — AudioNode, receives onTick/onBeat from Sync
3. `bass/BassCommands.h` — waveform, filter cutoff, resonance, envelope
4. Connect `BassNode → MixerNode` in AudioGraphManager
