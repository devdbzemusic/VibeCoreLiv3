# VibeCoreLiv3 — Runtime Authority & Call-Graph Audit

Stand: 2026-09-16
Basis-HEAD: `308ae3849ca5bbce9142252f660e4bc2bc870672`
Status: `STATICALLY VERIFIED / IN PROGRESS`

This document records only source-proven edges. Comments and design intent are not upgraded to runtime truth without a concrete call edge.

## 1. AudioBackend contract

`src/lib/audio/AudioBackend.ts` defines `AudioBackend` with lifecycle, transport, position/tick, tempo, master gain, sample loading, note on/off, diagnostics and close.

Native bridge contract is separately typed as `VibeCoreNativeBridge` and is backed by `window.VibeCoreNative`.

Factory behavior:

```text
isNativeOboeAvailable()
  → createAudioBackend()
      → new NativeOboeBackend()
```

No concrete `WebAudioBackend implements AudioBackend` was found in the audited source path. Browser fallback remains the pre-existing WebAudio engine directly.

### Classification

- `NativeOboeBackend implements AudioBackend` — STATICALLY VERIFIED
- browser implementation of the exact `AudioBackend` interface — NOT FOUND in audited path
- therefore `AudioBackend` is currently a native adapter contract plus null fallback, not yet a symmetric two-backend abstraction

## 2. NativeOboeBackend instantiation

`NativeOboeBackend` is instantiated by `createAudioBackend()` only when `window.VibeCoreNative?.isAvailable()` succeeds.

`nativeAudioRuntime.ts` owns a module-global:

```ts
let backend: AudioBackend | null = null;
```

and lazily initializes it in `activateNativeAudio()`:

```text
backend ??= createAudioBackend()
→ backend.init()
→ backend.startEngine()
→ setTempo
→ setMasterGain
→ syncNativeSeek
```

This is the currently proven TypeScript owner of the Native backend instance.

## 3. App startup ownership

`src/pages/Index.tsx` mounts these bindings once:

```text
bindNativeAudioRuntime()
bindInternalSource()
initSchedulerBindings()
bindParamUpdates()
startQualityManager()
```

This proves both Native runtime binding and browser scheduler binding are installed during app mount.

## 4. Browser vs Native scheduler exclusion

`initSchedulerBindings()` subscribes to transport state.

On every playing-state transition it performs:

```text
if (isNativeAudioPath()) return
```

before starting/stopping the WebAudio scheduler.

Therefore source code explicitly prevents the WebAudio look-ahead scheduler from being started on a detected Native path.

### Status

`STATICALLY VERIFIED`

### Runtime caveat

This still requires Android execution proof showing:

- `window.VibeCoreNative` is injected before the binding decision,
- `isAvailable()` is true when expected,
- the browser scheduler timer is not armed,
- native transport actually runs.

Until then: runtime single-authority = `NOT EXECUTED`.

## 5. Browser scheduling path

Browser path:

```text
Store transport.playing
→ initSchedulerBindings()
→ startScheduler()
→ ensureAudio()
→ MasterClock.startTransportPhase()
→ armTimer()
→ window.setInterval(tick, schedulerTickMs)
→ tick()
→ AudioContext.currentTime look-ahead
→ scheduleTickAt(...)
→ triggerPart(...)
→ WebAudio engine voice/DSP path
```

Important: `setInterval` is a wake-up mechanism; scheduled event timestamps are based on `AudioContext.currentTime` and `nextTickTime`.

The browser scheduler is therefore timer-woken but audio-clock-scheduled.

## 6. Browser masterClock

`masterClock.ts` is pull-based for musical position and does not contain an interval scheduler.

Its `requestAnimationFrame` loop exists only to notify subscribers.

Key timing state:

- BPM
- beatsPerBar
- source
- anchorAudioTime
- offsetBeats
- output latency compensation
- transport hold/start phase

### Tick domain

Browser `ClockState.tick` is:

```text
tick = beat * 24
```

This is a 24-ticks-per-beat domain.

## 7. Native sync domain

`nativeAudioRuntime.ts` documents native PPQ 1920 and converts a sixteenth note to:

```text
NATIVE_TICKS_PER_STEP = 480
```

`VibeCoreSync` emits native ticks at its `kPPQ` resolution and schedules them sample-accurately inside the Oboe callback.

### Contract issue

Browser MasterClock tick domain (`24 ticks/beat`) and native VibeCoreSync (`1920 ticks/quarter`) are different units.

This is not necessarily a defect if they are intentionally separate typed domains, but no implicit interchange is allowed.

Required follow-up:

- define names/units explicitly (`Clock24Tick`, `NativePpq1920Tick`, `SceneStep`, etc.),
- prove all bridge conversions,
- add contract tests preventing accidental cross-domain use.

Status: `CONTRACT GAP / STATICALLY VERIFIED`

## 8. TypeScript → Kotlin bridge

Proven core path:

```text
NativeOboeBackend.startEngine()
→ window.VibeCoreNative.startEngine()
→ NativeAudioBridge.startEngine()
→ nativeStartEngine()

NativeOboeBackend.play()
→ VibeCoreNative.play()
→ NativeAudioBridge.play()
→ nativeTransportPlay()

NativeOboeBackend.stop()
→ voiceAllNotesOff()
→ NativeAudioBridge.voiceAllNotesOff()
→ nativeVoiceAllNotesOff()

NativeOboeBackend.setTempo()
→ NativeAudioBridge.setTempo()
→ nativeSetTempo()

NativeOboeBackend.setPosition()
→ NativeAudioBridge.setPosition()
→ nativeSetPosition()

NativeOboeBackend.noteOn()
→ NativeAudioBridge.voiceNoteOn()
→ nativeVoiceNoteOn()

NativeOboeBackend.noteOff()
→ NativeAudioBridge.voiceNoteOff()
→ nativeVoiceNoteOff()
```

The narrow `VibeCoreNativeBridge` interface aligns with corresponding Kotlin `@JavascriptInterface` methods for lifecycle, transport, tempo, master gain, position/tick, diagnostics and Voice sample/note calls.

The Kotlin bridge surface is much larger than the narrow TypeScript interface; Groove/Bass/Voice bridge methods require a separate caller inventory.

A method-by-method narrow contract table now lives in `docs/BRIDGE_CONTRACT_MATRIX.md`.

## 9. Kotlin → JNI → C++ core

`jni_bridge.cpp` proves:

```text
nativeStartEngine
→ engine().start()

nativeStopEngine
→ engine().stop()

nativeTransportPlay
→ engine().transportPlay()

nativeTransportStop
→ engine().transportStop()

nativeSetTempo
→ engine().setTempo()

nativeSetPosition
→ engine().setPosition()

nativeGetCurrentTick
→ engine().currentTick()
```

Singleton-like owners are held in JNI translation-unit statics:

- `gEngine`
- `gGroove`
- `gBass`
- `gVoice`

Groove is created before instrument nodes so trigger dispatch happens before their render stage in the same callback.

## 10. C++ → Oboe stream

`VibeCoreAudioEngine::start()`:

```text
queryCapabilities()
→ sampleRate / burstFrames
→ recreate VibeCoreSync(real sample rate)
→ PerformanceMonitor.prepare
→ AudioGraph.prepare
→ openStream()
```

`openStream()` configures:

```text
Direction = Output
PerformanceMode = LowLatency
SharingMode = Exclusive if supported, otherwise Shared
Format = Float
Channels = Stereo
SampleRate = device-selected mSampleRate
FramesPerDataCallback = device burstFrames
DataCallback = VibeCoreAudioEngine
ErrorCallback = VibeCoreAudioEngine
→ openStream
→ requestStart
```

This statically proves `VibeCoreAudioEngine` owns the Oboe DataCallback.

## 11. Oboe callback → Sync → Graph → Output

`VibeCoreAudioEngine::onAudioReady()` order is explicitly:

```text
1 PerformanceMonitor callback start
2 drain engine command queue
3 VibeCoreSync.processCallback(absoluteSamplePos, numFrames)
4 AudioGraph.dispatchSyncEvents(events)
5 AudioGraph.process(outputBuffer)
6 apply master gain
7 calculate latency estimate
8 advance absolute sample position
9 PerformanceMonitor callback end
10 Continue
```

This is the currently proven native audio authority path.

## 12. AudioGraph rendering

`AudioGraphManager::dispatchSyncEvents()` sends transport/tick/beat/bar/loop/tempo events to all enabled nodes in render order.

`AudioGraphManager::process()`:

```text
clear final output
→ process each node into its AudioBus
→ identify leaf nodes
→ sum leaf AudioBus data into final Oboe output buffer
```

Render order uses topological ordering with insertion order for equal precedence.

## 13. Scheduler → Trigger → Voice

Native Groove path:

```text
VibeCoreSync TickEvent
→ AudioGraph.dispatchSyncEvents
→ GrooveNode.onTick
→ StepSequencer.onTick
→ TriggerQueue
→ GrooveNode.process
```

Inside `GrooveNode.process`:

```text
Drum mode
→ Groove VoicePool.trigger

Bass mode
→ BassNode.notifyGrooveTrigger

Voice mode
→ VoiceNode.notifyGrooveTrigger
```

The Groove node is inserted before instrument nodes specifically so trigger dispatch reaches Bass/Voice before those nodes render in the same callback.

## 14. Drum Voice allocation

`groove/VoicePool.cpp` proves:

```text
Trigger
→ validate sample
→ choke group
→ find idle voice
   or find steal voice
→ configure Voice
   state Playing
   sample pointer
   frame startOffset
   envelope
   velocity gain
   pitch step
→ VoicePool.process
→ renderVoice
→ linear interpolation
→ mono-to-stereo accumulation
→ output AudioBus
```

Voice stealing exists and is deterministic from current pool state and iteration order.

## 15. Voice instrument path

Direct bridge note:

```text
TS NativeOboeBackend.noteOn
→ Kotlin voiceNoteOn
→ JNI nativeVoiceNoteOn
→ VoiceEngine.noteOn
→ VoiceCommand queue
→ VoiceNode.drainCommandQueue
→ VoicePool.noteOn
```

Groove-triggered Voice path bypasses the UI command queue and calls:

```text
GrooveNode.process
→ VoiceNode.notifyGrooveTrigger
→ VoicePool.noteOn/noteOff
```

This occurs on the Audio Thread.

## 16. Voice DSP path

`VoiceNode.process()` proves this native processing chain:

```text
command drain
→ source (sample VoicePool or non-blocking live input)
→ pitch shift
→ formant shift
→ harmonizer/doubler
→ breath layer
→ gate
→ de-esser
→ compressor
→ EQ
→ 3D stereo
→ volume/dry-wet
→ AudioBus output
```

Then `AudioGraphManager` sums the leaf bus into the final Oboe output buffer.

## 17. Browser trigger/DSP/output path

`engine.ts` proves the browser path:

```text
scheduleTickAt()
→ triggerPart()
→ central voiceAllocator request
→ source branch
   ├─ sample one-shot / granular stretch
   ├─ 3D Synth
   ├─ 3D Bass
   ├─ legacy synth
   └─ hybrid sample/synth/sub
→ part chain.input
→ HP
→ LP
→ drive
→ channel EQ
→ volume/pan
→ dry + FX sends
→ masterIn
→ master EQ
→ stereo width
→ soft clip
→ master gain
→ limiter
→ AudioContext.destination
```

The current browser implementation therefore remains a direct WebAudio runtime, not a concrete `WebAudioBackend` adapter implementing the same TypeScript contract as native.

## 18. Critical unresolved edge — Store → Native Groove state

This is now the highest-priority unresolved graph edge.

Static facts:

- Zustand `store.ts` owns Pattern/Scene/Step/Piano-Roll project state.
- Kotlin exposes `grooveSetStep`, `grooveSetPatternLength`, `grooveSetTrack*`, scene and Piano-Roll methods.
- JNI maps those calls into native `GrooveEngine/GrooveNode`.
- `AudioBackend` / `nativeAudioRuntime` prove transport/tempo/gain/seek, but do not contain Groove project-state mirroring methods.
- no dedicated Groove-native TypeScript bridge file appears in the current `src/lib` file inventory.
- the inspected `store.ts` contains no `VibeCoreNative` or `grooveSetStep` call.

Therefore the exact caller chain that synchronizes current Web/Zustand Groove state into the native Groove engine is not yet proven.

### Status

`P0 UNKNOWN`

### Why this matters

A valid native scheduler and Oboe callback do not prove correct song playback if the native sequencer has not received the current Pattern/Scene/Step data.

Required proof:

```text
UI edit
→ Zustand action
→ TypeScript native state-transfer call
→ Kotlin groove* bridge
→ JNI nativeGroove*
→ GrooveEngine/GrooveNode command queue
→ native StepSequencer state
→ trigger during native transport
```

If this edge does not exist, it becomes an implementation gap only after the audit confirms absence.

## 19. Capability Registry correction

`src/lib/capabilities/registry.ts` exists in the current HEAD and is therefore not a missing capability.

Previous audit text that called Capability Registry absent/GAP is superseded.

However adoption as the sole capability authority remains incomplete, and its previous `android.native-oboe = VERIFIED` classification was too strong without device evidence. The revision branch now classifies the native Oboe capability as `STATICALLY_VERIFIED` and keeps actual APK/device measurements `NOT_EXECUTED`.

## 20. Timing API classification found so far

### `setInterval`

- `scheduler.ts`: MUSICAL SCHEDULER WAKE-UP on WebAudio path. Audio timestamps are still based on `AudioContext.currentTime`.

### `requestAnimationFrame`

- `masterClock.ts`: subscriber notification/UI observation; not the audio scheduling clock.

### `performance.now`

- `scheduler.ts`: scheduler drift/callback-cost telemetry and UI playhead write throttling.

### `Date.now`

- `scheduler.ts`: fallback for UI playhead write throttling when `performance` is unavailable.

### `setTimeout`

- inspected `engine.ts` uses timeouts for cleanup/release bookkeeping such as delayed voice-gain unregister/release after audio events have already been timestamp-scheduled. These occurrences are not the beat-grid authority.

### Native time

- Native musical time in the proven path is derived inside `VibeCoreSync::processCallback()` from audio callback sample position, callback frame count, BPM and PPQ.
- `VoiceEngine` uses `std::chrono` only in the inspected sample-retirement wait path on the non-audio/UI side; this is not musical timing.

### Still required

Repository-wide classification remains incomplete because connected GitHub code search currently returns no matches for generic timing-token searches. Known timing-critical files are being inspected directly, but this limitation remains explicit.

## 21. Important static finding: multiple timing representations

The project currently has at least three explicit timing representations:

```text
Browser MasterClock: beat-based clock with tick = beat * 24
Browser scheduler: globalTick/songTicks = sixteenth-note counters
Native VibeCoreSync: PPQ-based sample-scheduled clock at 1920 PPQ
```

These can coexist only if their units and conversion boundaries are explicit. They must not be treated as one raw integer tick type.

Required tests:

- browser beat ↔ scheduler sixteenth conversion
- scheduler sixteenth ↔ native PPQ conversion (×480)
- seek conversion
- start/resume phase equivalence
- BPM-change continuity
- no tick-domain leakage across bridge APIs

## 22. Tests defined against the observed graph

The concrete contract/null/timing/runtime plan now lives in:

`docs/RUNTIME_AUTHORITY_TEST_PLAN.md`

It covers:

- AudioBackend coverage
- TS ↔ Kotlin contract
- Kotlin ↔ JNI symbol coverage
- JNI ↔ C++ target mapping
- Groove state-transfer proof
- bridge/library/stream failure cases
- browser/native scheduler exclusion
- tick-domain conversions
- trigger/voice paths
- real-device evidence gate

## 23. Performance truth

No measured values are claimed.

- CPU: `UNKNOWN`
- RAM: `UNKNOWN`
- XRuns: `UNKNOWN`
- Jitter: `UNKNOWN`
- Latency: `UNKNOWN`
- Callback duration: `UNKNOWN`

Static configuration and code structure are not measurement results.

## 24. Current static conclusion

The source now provides strong static evidence for this Native chain:

```text
React Store / startup binding
→ nativeAudioRuntime
→ AudioBackend
→ NativeOboeBackend
→ window.VibeCoreNative
→ Kotlin NativeAudioBridge
→ JNI
→ VibeCoreAudioEngine
→ Oboe DataCallback
→ VibeCoreSync
→ AudioGraph
→ Groove/Voice/Bass nodes
→ DSP / voices
→ leaf buses
→ final Float output
→ Oboe stream
```

It also provides static evidence that the WebAudio scheduler is skipped on a detected Native path and that the browser WebAudio trigger/master path is real.

The largest unresolved authority question is now not whether the Native engine exists, but whether the current Web project state is completely mirrored into the native Groove engine before native playback.

What is NOT yet runtime proven:

- complete Store → Native Groove data path
- real-device bridge injection timing
- real-device Native path selection
- absence of every other musical timer elsewhere in the repository
- APK execution
- audio latency
- xRuns
- callback budget
- CPU/RAM/thermal behavior
- complete caller inventory for the larger Kotlin bridge surface

Therefore `ONE AUDIO AUTHORITY` and `ONE MASTER CLOCK` are currently **strongly supported statically but not runtime VERIFIED**.
