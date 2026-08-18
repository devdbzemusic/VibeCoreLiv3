---
name: Native Audio Platform
description: Phase build order, architecture invariants, all phases complete through Phase 5 — 3D Bass implemented and GO'd
---

## Phase Status

| Phase | Name | Status |
|-------|------|--------|
| Phase 1 | Oboe Native Audio Foundation | ✅ COMPLETE |
| Phase 2 | VibeCore Sync (PPQ 1920) | ✅ COMPLETE |
| Phase 3 | VibeCore Groove Engine | ✅ COMPLETE |
| Phase 4 | Architecture Hardening | ✅ COMPLETE — ARCHITECTURE FROZEN |
| Phase 5 | 3D Bass — Native Wavetable Bass Engine | ✅ COMPLETE — GO |
| Phase 6 | VibeCore Voice (next) | NEXT |

---

## Architecture Invariants (enforce across ALL edits — FROZEN since Phase 4)

1. **ONE Oboe engine** — `VibeCoreAudioEngine` singleton. Never create a second stream.
2. **ONE global clock** — `VibeCoreSync`. No module has its own clock/scheduler/timer.
3. **Zero heap allocation on Audio Thread** — All arrays fixed-size; all commands via queues.
4. **Zero locks on Audio Thread** — All cross-thread state via `AudioThreadSafeQueue<T, N>`.
5. **MusicalPosition derived from absoluteSamplePos** — never from system time.
6. **All AudioNode timing events carry `sampleOffset`** — sample-accurate, not buffer-late.
7. **No legacy files** — `vibecore_engine.cpp/h` and root `jni_bridge.cpp` deleted in Phase 4.
8. **UI mirror pattern** — UI thread owns UIXxxState mirror; Audio Thread owns mParams. Never cross.

---

## New Module Pattern (Phase 6+)

```cpp
class VoiceNode : public AudioNode {
public:
    VoiceNode(NodeId id);
    void prepare(int sampleRate, int maxFrames) override;
    void reset()                                 override;
    void process(const float*, float*, int, int) noexcept override;
    void onTick(int64_t, const MusicalPosition&, int32_t) noexcept override;
    void onBeat(int64_t, const MusicalPosition&, int32_t) noexcept override;
    void onTempoChanged(double, int32_t) noexcept override;
};
auto id = engine.graph().addNode(std::make_unique<VoiceNode>(3));
engine.graph().connect(id, mixerId);
```

BassNode is the reference implementation. All future instruments follow this pattern exactly.

---

## Queue System

| Queue | Type | Capacity | Producer | Consumer |
|-------|------|----------|---------|---------|
| SyncCommand | SPSC | 128 | UI/MIDI Thread | Audio Thread (VibeCoreSync) |
| GrooveCommand | SPSC | 256 | UI Thread (GrooveEngine) | Audio Thread (GrooveNode) |
| BassCommand | SPSC | 256 | UI Thread (BassEngine) | Audio Thread (BassNode) |
| AudioCommand | SPSC | 128 | UI Thread | Audio Thread (VibeCoreAudioEngine) |
| TriggerQueue | Sequential | 256 | Audio Thread onTick() | Audio Thread process() |

---

## Bass Engine — Key Invariants (Phase 5)

- BassNode is NodeId=2 in AudioGraphManager
- `BassNode::notifyGrooveTrigger()` — zero-latency Audio Thread direct call (no queue)
- `BassEngine::snapshotBefore()` reads `mUIState.params` before every destructive mutation
- `UIBassState` updated on every BassEngine mutation — UI Thread only
- Undo depth: 32 BassParamSnapshot in ring buffer
- Wavetable data: pre-computed at init(), never on Audio Thread (~724KB RAM)
- BassCommand payload: ~1KB; queue = 256 slots = 256KB RAM

---

## Groove Integration Pattern (zero-latency)

```
GrooveNode::onTick() [Audio Thread]
  → BassNode::notifyGrooveTrigger(BassTrigger{sampleOffset})
    → BassVoicePool::noteOn()  [no queue — already on AT]
```

UI-triggered notes use BassEngine::noteOn() → BassCommand queue → ≤1 buffer latency.

---

## Key Files

### Phase 5 Bass
- `bass/BassTypes.h` — all types, enums, BassVoice, BassParams, UIBassState
- `bass/BassCommands.h` — 50+ command types
- `bass/BassWavetable.h/.cpp` — 8 waveforms × 11 mip levels, morphing, anti-aliasing
- `bass/BassFilter.h/.cpp` — LP/HP/BP/Notch biquad, drive, stereo
- `bass/BassEnvelope.h/.cpp` — ADSR, linear attack, exp decay/release
- `bass/BassLFO.h/.cpp` — 5 shapes, free/beat/bar sync, retrigger
- `bass/BassVoice.h/.cpp` — full voice: osc + envs + LFOs + filter + mod matrix
- `bass/BassVoicePool.h/.cpp` — 16 voices, free list O(1), deterministic stealing
- `bass/Bass3DStereo.h/.cpp` — M/S matrix, stereo width, constant-power pan
- `bass/BassNode.h/.cpp` — AudioNode, 7 timing callbacks, command queue drain
- `bass/BassEngine.h/.cpp` — UI API, UI mirror, preset undo (32 depth)
- `bridge/jni_bridge.cpp` — updated header + ensureBass() + #include jni_bass_bridge.cpp
- `bridge/jni_bass_bridge.cpp` — 48 JNI functions for Bass
- `NativeAudioBridge.kt` — 48 @JavascriptInterface + private external declarations added

### Architecture documents
- `docs/ARCHITECTURE_FREEZE.md` — frozen architecture (Phase 4)
- `docs/adr/ADR-001..006` — Phase 1-4 decisions
- `docs/adr/ADR-007-bass-architecture.md` — Bass: AudioNode, wavetable, voice, filter, mod, 3D

---

## Open Risks (post-Phase 5)

| # | Risk | Severity |
|---|------|----------|
| B-01 | HRTF binaural: pass-through | LOW |
| B-02 | Oversampling ×2/×4: prepared, not active | LOW |
| B-03 | S&H LFO deterministic (no rand on AT) | LOW |
| B-04 | Custom wavetable slots not JNI-populatable | LOW |
| B-05 | Ladder/SVF filter prepared but not implemented | LOW |
| R-5-1 | ADR-005 JSI/TurboModule path undefined | MEDIUM |

---

## Phase 6 — VibeCore Voice (NEXT)

**Files to create:**
1. `voice/VoiceTypes.h` — polyphonic voice, unison, chord types
2. `voice/VoiceCommands.h`
3. `voice/VoiceOscillator.h/.cpp` — multi-oscillator, unison detune, chord mode
4. `voice/VoiceNode.h/.cpp` — AudioNode, NodeId=3
5. `voice/VoiceEngine.h/.cpp` — UI API, same pattern as BassEngine

**Reuse from Phase 5 (no copy):**
- BassFilter — voice gets its own instance
- BassEnvelope — voice gets its own instances
- BassLFO — voice gets its own instances
- Bass3DStereo — voice gets its own instance

**New in Phase 6:**
- B-02: Oversampling ×2/×4 (oversample buffer in VoicePool or BassPool)
- B-05: Ladder filter implementation
- ADR-005: JSI bridge decision

## Build-Host-Gate (2026-08-18)
- Build-Host komplett im Repo: settings/build/gradle.properties + kompletter Wrapper (offizielle v8.7.0-Artefakte) + Manifest + MainActivity/Application. Status: BUILD-READY / RUNTIME UNVERIFIED (kein SDK/NDK im Repl).
- ZWEI JS-Interfaces: `window.VibeCoreNative` (Audio-Bridge, ADR-005) + `window.VibeCoreHost` (Mikrofon-Permission-Flow). Fokusverlust wird im Host DURCHGESETZT (stop/stopEngine), Auto-Resume bewusst nicht.
- Oboe-1.9-API-Fallen (real im Code gefunden): Builder-Setter geben `AudioStreamBuilder*` zurück → Pointer-Chaining `->`, nie `.`; `ResultWithValue` hat KEIN `isOk()` → `error()==Result::OK`; Klasse fehlender `../threads/ThreadModel.h`-Includes zieht sich durch platform/ (Assert-Makros).
- jni_bass_bridge.cpp / jni_voice_bridge.cpp sind #include-only in jni_bridge.cpp (CMake kompiliert nur jni_bridge.cpp) — nie standalone syntax-checken.

## Native Build Execution Gate (2026-08-18) — BUILD VERIFIED
- Realer Android-Build IM REPL möglich: nix jdk17 + cmdline-tools nach `.android-sdk/` (Platform 34, Build-Tools 34.0.0, NDK 26.1.10909125, CMake 3.22.1; ~2,6 GB), `sdk.dir` via native-android/local.properties (gitignored). `./gradlew :app:assembleDebug --no-daemon` → BUILD SUCCESSFUL (~1 min nach Erstkonfiguration).
- nohup-Hintergrundprozesse überleben ShellExec-Sessions NICHT — Gradle-Läufe im Vordergrund mit `timeout 290` fahren; Gradle-Cache macht Wiederholungsläufe schnell.
- Runtime bleibt im Repl unverifizierbar: kein adb-Gerät, kein /dev/kvm (kein Emulator). Maximalstand hier: APK-Nachweis + statische DEX-/Symbol-Checks.
