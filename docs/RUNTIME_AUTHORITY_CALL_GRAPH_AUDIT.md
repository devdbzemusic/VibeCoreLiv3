# Runtime Authority & Call-Graph Audit

Stand: 2026-09-16
Reference HEAD for initial truth pass: `308ae3849ca5bbce9142252f660e4bc2bc870672`

## Purpose

Prove the real audio/runtime/timing graph before any consolidation refactor changes ownership.

## Mandatory trace

### A. TypeScript contract and backend
- [x] Fetch exact `src/lib/audio/AudioBackend.ts`
- [x] Fetch exact `src/lib/audio/NativeOboeBackend.ts`
- [x] Fetch exact `src/lib/audio/nativeAudioRuntime.ts`
- [ ] Find every `AudioBackend` implementation
- [ ] Find every `createAudioBackend()` call
- [ ] Find every `new NativeOboeBackend()`
- [ ] Find every import/call of `activateNativeAudio`
- [ ] Find every import/call of `bindNativeAudioRuntime`
- [ ] Find every import/call of `getNativeAudioBackend`
- [ ] Find every import/call of `setNativeMasterGain`

### B. TypeScript → Kotlin
Correlate every method from `VibeCoreNativeBridge` with `NativeAudioBridge.kt`:
- availability
- engine lifecycle
- transport
- tempo
- master gain
- position/tick
- latency/diagnostics
- voice sample load/clear
- voice note on/off/all notes off

Then inventory the larger Kotlin bridge surface beyond the narrow TS interface (Groove, Scene, Piano Roll, Bass, Voice, diagnostics etc.) and identify which TypeScript paths call it.

### C. Kotlin → JNI
For every Kotlin `nativeXxx` declaration:
- exact JNI symbol
- source file
- argument conversion
- error/fallback behavior
- target C++ object/method

Priority symbols:
- nativeStartEngine
- nativeStopEngine
- nativeIsEngineRunning
- nativeTransportPlay/Stop/IsPlaying
- nativeSetTempo/nativeGetTempo
- nativeSetMasterGain
- nativeSetPosition/nativeGetCurrentTick
- nativeGetLatencyMs/nativeGetDiagnosticStatus
- native voice load/note functions

### D. JNI → C++ runtime
Trace:
- global/singleton engine ownership
- engine creation/destruction
- stream creation
- start/stop
- transport state
- master gain
- clock/sync
- voice engine attachment
- graph/mixer ownership

### E. C++ → Oboe
Find and document:
- `oboe::AudioStreamBuilder`
- `oboe::AudioStream`
- callback class/function
- requested API/performance/sharing mode
- format/channel/sample-rate/frame configuration
- actual vs requested configuration handling
- stream error/disconnect callback
- restart/recovery path

### F. Callback → Output
Prove exact callback path:

`Oboe data callback`
→ `engine render/process`
→ `VibeCoreSync tick/transport update`
→ `Groove/Voice/Bass/Synth processing`
→ `AudioGraph/Mixer`
→ `master DSP/gain/limiter if any`
→ `Float32 stereo output`

Every missing edge is `UNKNOWN`, not inferred.

## MasterClock / scheduler audit

### masterClock.ts
- [ ] fetch complete file
- [ ] identify time source
- [ ] identify PPQ/tick semantics
- [ ] identify transport ownership
- [ ] identify subscribers/consumers
- [ ] compare browser tick domain against native PPQ 1920

### Scheduler lifecycle
Locate all scheduler construction/start/stop and classify:

- browser sequencer scheduler
- arp scheduler
- automation/motion scheduler
- synced FX/LFO scheduler
- native VibeCoreSync scheduler
- MIDI/OSC/external sync scheduler

For each:
- constructor/factory
- lifecycle owner
- clock source
- scheduling horizon
- trigger destination
- native/browser gating

### Repository-wide timing scan
Search every current source for:
- `setInterval`
- `setTimeout`
- `requestAnimationFrame`
- `Date.now`
- `performance.now`
- `AudioContext.currentTime`
- `clock_gettime`
- `std::chrono`
- Android native/system clock APIs

Classify each occurrence:

| Classification | Allowed |
|---|---|
| UI animation/sample | yes |
| diagnostics/perf measurement | yes |
| debounce/non-musical UX | yes |
| musical scheduling derived from master | conditional |
| independent musical clock | no |
| unknown | investigate |

## Trigger / voice proof

Trace at least these events:

### Live keyboard note
UI pointer/MIDI event
→ input layer
→ timing authority
→ runtime backend
→ noteOn
→ voice allocation
→ voice start
→ DSP
→ mixer
→ output

### Groove step
Master timing
→ scheduler/step engine
→ trigger
→ sample/voice allocation
→ channel processing
→ mixer
→ output

### Arpeggiator note
Input/chord
→ arp event generation
→ master timing
→ trigger
→ voice
→ output

### Stop / panic
UI/store transport stop
→ backend/native transport stop
→ all notes off / release
→ callback silence

## Tests to define only after graph proof

### Contract tests
- TS `AudioBackend` ↔ native adapter method coverage
- TS bridge interface ↔ Kotlin `@JavascriptInterface`
- Kotlin native declarations ↔ JNI exported symbols
- JNI mapping ↔ C++ engine methods

### Null/failure tests
- bridge absent
- library load failure
- native start failure
- stream open/start failure
- device disconnect
- invalid voice slot/note/sample
- stop before start
- repeated init/start/stop/close
- background/foreground

### Timing tests
- tick monotonicity
- BPM change continuity
- seek accuracy
- start/stop semantics
- bar/beat/tick consistency
- browser/native PPQ conversion
- scheduler trigger jitter
- no duplicate trigger across browser/native switch
- no second musical clock while native path is active

### Native runtime evidence
Must eventually include real execution evidence for:
- APK build/install/launch
- stream API and actual configuration
- callback activity
- latency
- xRuns
- timing jitter
- CPU/RAM
- recovery on audio device/lifecycle events

## Current first-pass findings

### STATICALLY VERIFIED
- `AudioBackend` interface exists.
- `NativeOboeBackend implements AudioBackend`.
- `createAudioBackend()` constructs `NativeOboeBackend` when `window.VibeCoreNative` is available.
- `nativeAudioRuntime.ts` owns a module-level `AudioBackend | null` and binds Store tempo/gain/transport/seek changes to the backend.
- native seek conversion currently uses `NATIVE_TICKS_PER_STEP = 480`, documented as PPQ 1920 / four sixteenth notes.
- `NativeAudioBridge.kt` exists under `com/vibecore/audio` and loads `vibecore-native`.
- Kotlin exposes engine/transport/tempo/gain/playhead/diagnostics and a much wider Groove/Bass/Voice bridge surface.

### NOT YET PROVEN
- that `bindNativeAudioRuntime()` is actually invoked in the active Android app path
- that no second WebAudio scheduler runs concurrently on Android
- complete TS → Kotlin method coverage
- Kotlin → JNI symbol completeness
- JNI → C++ engine graph
- C++ callback → mixer/DSP → output graph
- single master clock across all musical modules
- native runtime performance

## Performance truth

No measured values are claimed.

CPU: `UNKNOWN`
RAM: `UNKNOWN`
XRuns: `UNKNOWN`
Jitter: `UNKNOWN`
Latency: `UNKNOWN`
Callback budget: `UNKNOWN`

Configuration targets are not measurements.
