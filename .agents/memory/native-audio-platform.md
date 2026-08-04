---
name: Native Audio Platform
description: Phase build order, architecture invariants, all phases complete through Phase 4 — Architecture Freeze in effect
---

## Phase Status

| Phase | Name | Status |
|-------|------|--------|
| Phase 1 | Oboe Native Audio Foundation | ✅ COMPLETE |
| Phase 2 | VibeCore Sync (PPQ 1920) | ✅ COMPLETE |
| Phase 3 | VibeCore Groove Engine | ✅ COMPLETE |
| Phase 4 | Architecture Hardening | ✅ COMPLETE — ARCHITECTURE FROZEN |
| Phase 5 | 3D Bass Node | NEXT |

---

## Architecture Invariants (enforce across ALL edits — FROZEN)

1. **ONE Oboe engine** — `VibeCoreAudioEngine` singleton. Never create a second stream.
2. **ONE global clock** — `VibeCoreSync`. No module has its own clock/scheduler/timer.
3. **Zero heap allocation on Audio Thread** — All arrays fixed-size; all commands via queues.
4. **Zero locks on Audio Thread** — All cross-thread state via `AudioThreadSafeQueue<T, N>`.
5. **MusicalPosition derived from absoluteSamplePos** — never from system time.
6. **All AudioNode timing events carry `sampleOffset`** — sample-accurate, not buffer-late.
7. **No legacy files** — `vibecore_engine.cpp/h` and root `jni_bridge.cpp` deleted in Phase 4.
8. **UI mirror pattern** — UI thread owns UITrack mirror; Audio Thread owns mTracks. Never cross.

---

## New Module Pattern (Phase 5+)

```cpp
class BassNode : public AudioNode {
public:
    BassNode(NodeId id);
    void prepare(int sampleRate, int maxFrames) override;
    void reset()                                 override;
    void process(const float*, float*, int, int) noexcept override;
    void onTick(int64_t, const MusicalPosition&, int32_t) noexcept override;
    void onTempoChanged(double, int32_t) noexcept override;
};
auto id = engine.graph().addNode(std::make_unique<BassNode>(2));
engine.graph().connect(id, mixerId);
```

No own clock. No own scheduler. No new queue types needed.

---

## Queue System

| Queue | Type | Capacity | Producer | Consumer |
|-------|------|----------|---------|---------|
| SyncCommand | SPSC | 128 | UI/MIDI Thread | Audio Thread (VibeCoreSync) |
| GrooveCommand | SPSC | 256 | UI Thread (GrooveEngine) | Audio Thread (GrooveNode) |
| AudioCommand | SPSC | 128 | UI Thread | Audio Thread (VibeCoreAudioEngine) |
| TriggerQueue | Sequential | 256 | Audio Thread onTick() | Audio Thread process() |

---

## Groove Engine — Key Invariants (Phase 4 hardened)

- `GrooveEngine::snapshotBefore(t)` reads `mUITracks[t].activePattern()` — real data
- `copyPattern(t)` copies from `mUITracks[t]` — always consistent
- `pastePattern(t)` is undo-able (calls snapshotBefore before paste)
- `UITrack[16]` updated on every GrooveEngine mutation — UI Thread only
- Undo depth: 64 PatternSnapshots in ring buffer

---

## Key Files

### All phases
- `platform/VibeCoreAudioEngine.h/.cpp` — owns Sync + Graph, Oboe callbacks
- `platform/sync/VibeCoreSync.h/.cpp` — ONE global clock, PPQ 1920
- `graph/AudioNode.h` — abstract base + 7 timing callbacks
- `graph/AudioGraphManager.h/.cpp` — DAG + dispatchSyncEvents
- `groove/GrooveNode.h/.cpp` — AudioNode, 16 tracks, all Groove
- `groove/GrooveEngine.h/.cpp` — UI API, UI mirror, Undo/Redo, Copy/Paste
- `bridge/jni_bridge.cpp` — JNI marshalling only (50+ functions)
- `NativeAudioBridge.kt` — @JavascriptInterface bridge

### Architecture documents
- `docs/ARCHITECTURE_FREEZE.md` — frozen architecture, all 9 gate questions
- `docs/adr/ADR-001..006` — all accepted decisions

---

## Open Risks (post-Phase 4)

| # | Risk | Severity |
|---|------|----------|
| R-S1 | Double-precision drift >24h session | LOW |
| R-G3 | Per-track volume scaling in VoicePool::trigger() | LOW |
| R-5-1 | ADR-005 JSI/TurboModule path undefined | MEDIUM |

---

## Phase 5 — 3D Bass (NEXT)

**Files to create:**
1. `bass/BassTypes.h` — waveform, envelope, filter types
2. `bass/BassCommands.h` — waveform, cutoff, resonance, ADSR commands
3. `bass/BassOscillator.h/.cpp` — wavetable oscillator, no malloc
4. `bass/BassNode.h/.cpp` — AudioNode, receives onTick from Sync, reads PianoRoll events
5. `bass/BassEngine.h/.cpp` — UI API + UIBassState mirror (same pattern as GrooveEngine)
6. Connect: `BassNode → MixerNode` in AudioGraphManager
