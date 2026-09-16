# VibeCoreLiv3 — Runtime Authority Test Plan

Stand: 2026-09-16
Basis: observed current-HEAD call graph, ADR-0002

This plan defines tests against the graph actually found. It does not mark any runtime result as passed.

## A. Contract tests

### A1 — AudioBackend implementation inventory
Assert/document:
- `NativeOboeBackend` satisfies every `AudioBackend` method.
- browser fallback currently has no concrete `WebAudioBackend implements AudioBackend`.
- `createAudioBackend()` returns native adapter only when `window.VibeCoreNative.isAvailable()` is true; otherwise returns null.

Expected current classification: `STATICALLY_VERIFIED`, execution `NOT_EXECUTED` on revision branch.

### A2 — Narrow TS bridge ↔ Kotlin
Create a contract table/test for every `VibeCoreNativeBridge` member:
- isAvailable
- startEngine / stopEngine / isEngineRunning
- play / stop / isPlaying
- setTempo / getTempo
- setMasterGain
- setPosition / getCurrentTick
- getLatencyMs / getDiagnosticStatus
- voiceLoadSample / voiceClearSample
- voiceNoteOn / voiceNoteOff / voiceAllNotesOff

Test goal: a TS bridge method may not exist without the exact Kotlin `@JavascriptInterface` counterpart.

### A3 — Kotlin external ↔ JNI symbol
For every Kotlin `private external fun nativeXxx`, verify an exported JNI symbol exists with:

`Java_com_vibecore_audio_NativeAudioBridge_nativeXxx`

Split by groups:
- engine/transport/sync
- Groove
- Bass
- Voice

No missing or orphan JNI symbol accepted.

### A4 — JNI ↔ C++ target
Verify each JNI function performs marshalling only and maps to the intended engine object/method.

Forbidden:
- scheduler/business logic in JNI
- hidden timing decisions in Kotlin/JNI
- direct DSP ownership in bridge code

## B. Native Groove state-transfer tests — P0

This is the highest-priority unresolved graph edge.

Observed:
- Zustand owns browser Pattern/Scene/Step/Piano-Roll state.
- Kotlin exposes `grooveSetStep`, `grooveSetPatternLength`, `grooveSetTrack*`, `grooveAddPianoRollNote`, etc.
- native C++ `GrooveEngine/GrooveNode` owns a separate native pattern/sequencer representation.
- the inspected `AudioBackend`/`nativeAudioRuntime` path only proves transport/tempo/gain/seek.
- `store.ts` contains no direct `VibeCoreNative`/`grooveSetStep` calls.

Required proof:
1. edit one step in UI
2. capture Zustand mutation
3. capture TS native call, if any
4. capture Kotlin bridge method
5. capture JNI method
6. capture C++ Groove command queue mutation
7. start native transport
8. prove that exact edited step triggers

Repeat for:
- velocity
- note
- probability
- mute/accent
- swing/humanize
- pattern length
- scene change
- track mute/solo/volume/sample/mode
- Piano Roll add/remove

If no TS native state-transfer layer exists, mark architecture gap explicitly before implementing one.

## C. Null / failure tests

### C1 — bridge missing
Environment: no `window.VibeCoreNative`.
Expected:
- `createAudioBackend()` returns null
- browser scheduler remains eligible
- no native calls

### C2 — bridge present but unavailable
`isAvailable() === false`.
Expected:
- no native backend activation
- failure is visible and deterministic
- no half-native state

### C3 — native library load failure
Force `System.loadLibrary("vibecore-native")` failure.
Expected:
- Kotlin `isAvailable()` false
- no crash
- no claim of native readiness

### C4 — stream open/start failure
Force Oboe open or `requestStart()` failure.
Expected:
- `NativeOboeBackend.startEngine()` rejects
- no silent WebAudio scheduler activation during the same active native session unless an explicit fallback contract is later designed
- state reports audio not ready

### C5 — repeated lifecycle
Test:
- init → start → start
- stop → stop
- close before start
- start → stop → start
- destroy while stopped/running

### C6 — audio focus/device change
Test permanent and transient focus loss plus device disconnect.
Expected contract must match `MainActivity` + native engine recovery policy.

## D. Scheduler authority tests

### D1 — Browser mode
With no native bridge:
- `initSchedulerBindings()` reacts to store transport
- scheduler timer arms
- musical timestamps come from `AudioContext.currentTime`
- `setInterval` only wakes scheduler

### D2 — Native mode exclusion
With native bridge available:
- transport play causes native runtime activation/play
- browser scheduler timer MUST remain unarmed
- `scheduleTickAt()` MUST NOT be called from browser transport scheduler
- exactly one musical trigger path exists

### D3 — Startup bindings
Prove `Index.tsx` mount invokes:
1. `bindNativeAudioRuntime()`
2. `bindInternalSource()`
3. `initSchedulerBindings()`
4. `bindParamUpdates()`

Add regression protection so future navigation/refactor cannot remove authority bindings silently.

## E. Timing-domain tests

Current units:
- Browser MasterClock tick: 24 ticks/beat
- Browser scheduler `songTicks/globalTick`: one unit per sixteenth
- Native: PPQ 1920 = 480 ticks/sixteenth

Tests:

### E1 — explicit conversion
For a 4/4 bar:
- beat 0 / sixteenth 0 / native tick 0
- beat 1 / sixteenth 4 / native tick 1920
- beat 4 / sixteenth 16 / native tick 7680

No generic conversion may assume all fields called `tick` have the same unit.

### E2 — seek
A browser scene/step seek converted by `NATIVE_TICKS_PER_STEP=480` must land on the expected native PPQ tick.

### E3 — BPM continuity
Tempo change while playing must not jump musical position in either runtime.

### E4 — stop/continue
Verify paused position is frozen and resume semantics match intended contract.

### E5 — loop
Verify loop start/end tick boundaries do not produce duplicate/missing trigger at wrap.

## F. Trigger / voice tests

### F1 — Browser Groove trigger
Prove:
`scheduleTickAt → triggerPart → requestVoice → source branch → part chain → master chain → destination`

Test source branches separately:
- sample
- 3D Synth
- 3D Bass
- legacy synth/hybrid only while still supported by migration state

### F2 — Native Groove drum trigger
Prove:
`VibeCoreSync → GrooveNode.onTick → StepSequencer → TriggerQueue → GrooveNode.process → VoicePool.trigger → VoicePool.process → graph output`

### F3 — Native Bass/Voice routing
TrackMode Bass/Voice must route Groove trigger to target node in the same callback and render after Groove due graph insertion/render order.

### F4 — Voice allocation
Test idle allocation, steal policy, choke/release, max voices and all-notes-off.

## G. Timer/clock audit tests

Every occurrence of these APIs must be classified:
- setInterval
- setTimeout
- requestAnimationFrame
- Date.now
- performance.now
- AudioContext.currentTime
- std::chrono
- native/system clock APIs

Allowed categories:
- UI animation
- diagnostics
- debounce/lifecycle
- musical scheduling derived from authority

Forbidden category:
- independent competing musical clock

Known current examples:
- `scheduler.ts setInterval`: scheduler wake-up, musical timestamp is AudioContext currentTime
- `masterClock.ts requestAnimationFrame`: subscriber/UI notification, not event scheduling
- `scheduler.ts performance.now/Date.now`: diagnostics/playhead throttling
- `engine.ts setTimeout`: voice/sample cleanup/release bookkeeping, not beat grid

Full repository classification remains incomplete until all source occurrences are enumerated.

## H. Real-device evidence gate

Static/unit tests do not complete Gate B0.

Required Android evidence:
- APK build
- install
- launch
- `window.VibeCoreNative` availability
- native library loaded
- Oboe stream opened and actual API/config reported
- callback activity
- exact native Groove state mirroring
- transport play/stop
- no duplicate WebAudio scheduler
- audible expected pattern
- device disconnect/recovery

Only after measurement:
- latency
- xRuns
- jitter
- CPU
- RAM
- callback duration/budget

Until then all remain `UNKNOWN` / `NOT_EXECUTED`.
