# VibeCoreLiv3 — Bridge Contract Matrix

Stand: 2026-09-16
Reference HEAD: `308ae3849ca5bbce9142252f660e4bc2bc870672`

## Purpose

This document records the statically proven TypeScript → Android WebView → Kotlin → JNI → C++ bridge chain. It is architecture evidence only; it does not replace APK/device runtime execution.

## 1. AudioBackend contract

`src/lib/audio/AudioBackend.ts` defines the current frontend backend contract.

Important finding: despite the comment mentioning two backends, only `NativeOboeBackend` is an actual `AudioBackend` implementation. Browser audio falls back directly to the existing `engine.ts` WebAudio runtime when `createAudioBackend()` returns `null`.

Therefore the current architecture is not yet:

`AudioBackend -> WebAudioBackend | NativeOboeBackend`

It is effectively:

`native: AudioBackend -> NativeOboeBackend`

`browser: scheduler/engine.ts direct WebAudio path`

This is a real runtime-contract asymmetry and must remain visible during consolidation.

## 2. Narrow TS bridge surface

| AudioBackend / TS call | VibeCoreNativeBridge | Kotlin @JavascriptInterface | Kotlin native declaration | JNI export | C++ target | Static status |
|---|---|---|---|---|---|---|
| init availability | `isAvailable()` | `isAvailable()` | n/a | n/a | library loaded flag | STATICALLY VERIFIED |
| startEngine | `startEngine()` | `startEngine()` | `nativeStartEngine()` | `Java_com_vibecore_audio_NativeAudioBridge_nativeStartEngine` | `VibeCoreAudioEngine::start()` | STATICALLY VERIFIED |
| stopEngine | `stopEngine()` | `stopEngine()` | `nativeStopEngine()` | matching JNI symbol | `VibeCoreAudioEngine::stop()` | STATICALLY VERIFIED |
| isEngineRunning | `isEngineRunning()` | same | `nativeIsEngineRunning()` | matching JNI symbol | `VibeCoreAudioEngine::isRunning()` | STATICALLY VERIFIED |
| play | `play()` | `play()` | `nativeTransportPlay()` | matching JNI symbol | `VibeCoreAudioEngine::transportPlay()` → `VibeCoreSync::play()` | STATICALLY VERIFIED |
| stop | `stop()` | `stop()` | `nativeTransportStop()` | matching JNI symbol | `VibeCoreAudioEngine::transportStop()` → `VibeCoreSync::stop()` | STATICALLY VERIFIED |
| isPlaying | `isPlaying()` | same | `nativeTransportIsPlaying()` | matching JNI symbol | `VibeCoreAudioEngine::transportIsPlaying()` | STATICALLY VERIFIED |
| setTempo | `setTempo()` | same | `nativeSetTempo()` | matching JNI symbol | `VibeCoreAudioEngine::setTempo()` → `VibeCoreSync::setTempo()` | STATICALLY VERIFIED |
| getTempo | `getTempo()` | same | `nativeGetTempo()` | matching JNI symbol | `VibeCoreAudioEngine::currentBpm()` | STATICALLY VERIFIED |
| setMasterGain | `setMasterGain()` | same | `nativeSetMasterGain()` | matching JNI symbol | `VibeCoreAudioEngine::setMasterGain()` → engine command queue | STATICALLY VERIFIED |
| setPosition | `setPosition()` | same | `nativeSetPosition()` | matching JNI symbol | `VibeCoreAudioEngine::setPosition()` → `VibeCoreSync::setPosition()` | STATICALLY VERIFIED |
| getCurrentTick | `getCurrentTick()` | same | `nativeGetCurrentTick()` | matching JNI symbol | `VibeCoreAudioEngine::currentTick()` | STATICALLY VERIFIED |
| latency | `getLatencyMs()` | same | `nativeGetLatencyMs()` | matching JNI symbol | `VibeCoreAudioEngine::estimatedLatencyMs()` | STATICALLY VERIFIED, measurement NOT EXECUTED |
| diagnostics | `getDiagnosticStatus()` | same | `nativeGetDiagnosticStatus()` | matching JNI symbol | `VibeCoreAudioEngine::diagnosticStatusLine()` | STATICALLY VERIFIED |
| voice sample load | `voiceLoadSample()` | same | `nativeVoiceLoadSample()` | `jni_voice_bridge.cpp` | `VoiceEngine::loadSample()` | STATICALLY VERIFIED |
| voice sample clear | `voiceClearSample()` | same | `nativeVoiceClearSample()` | `jni_voice_bridge.cpp` | `VoiceEngine::clearSample()` | STATICALLY VERIFIED |
| noteOn | `voiceNoteOn()` | same | `nativeVoiceNoteOn()` | `jni_voice_bridge.cpp` | `VoiceEngine::noteOn()` → `VoiceNode` command queue → VoicePool | STATICALLY VERIFIED |
| noteOff | `voiceNoteOff()` | same | `nativeVoiceNoteOff()` | `jni_voice_bridge.cpp` | `VoiceEngine::noteOff()` → VoicePool | STATICALLY VERIFIED |
| allNotesOff | `voiceAllNotesOff()` | same | `nativeVoiceAllNotesOff()` | `jni_voice_bridge.cpp` | `VoiceEngine::allNotesOff()` | STATICALLY VERIFIED |

## 3. Kotlin exposes a much larger native surface

`NativeAudioBridge.kt` additionally exposes direct methods for:

- Groove step editing
- pattern length / swing / humanize
- Groove undo/redo
- track mute/solo/volume/sample/mode
- scene queueing
- Piano Roll note editing
- Groove runtime queries
- Bass synthesis parameters/triggers
- Voice processing parameters
- live voice input
- Android device/audio-focus events

These are not all represented by `VibeCoreNativeBridge` or `AudioBackend`.

This means `AudioBackend` is currently a narrow lifecycle/transport/voice subset, not the complete native-runtime contract.

## 4. Native WebView injection

`MainActivity.kt` constructs `NativeAudioBridge` and injects it as exactly:

`window.VibeCoreNative`

using:

`webView.addJavascriptInterface(bridge, "VibeCoreNative")`

The same activity loads the packaged Vite application from:

`file:///android_asset/webapp/index.html`

This closes the static host-injection edge.

## 5. Startup binding

`src/pages/Index.tsx` calls on mount:

1. `bindNativeAudioRuntime()`
2. `bindInternalSource()`
3. `initSchedulerBindings()`
4. `bindParamUpdates()`

The browser scheduler checks `isNativeAudioPath()` and does not start its WebAudio look-ahead scheduler when the native bridge reports available.

Static conclusion: browser/native scheduler mutual exclusion is intentionally wired and invocation is proven in source.

Runtime conclusion: still NOT EXECUTED on device.

## 6. Major unresolved contract question — Groove state transfer

The native C++ Groove engine is real and its Kotlin bridge exposes pattern/step/scene/Piano-Roll setters.

However the narrow `AudioBackend` contract does not contain those methods, and no dedicated Groove-native bridge module is visible in the current `src/lib` file inventory.

Until a concrete TypeScript caller is proven for those `groove*` methods, the following remains `UNKNOWN`:

> Does the current Web/Zustand Groove project state get mirrored into the native GrooveEngine before native transport playback?

This is a release-blocking runtime-authority question because native timing can be perfectly implemented while still scheduling a stale/default native pattern.

## 7. Browser audio path

Browser path is statically proven as:

`store transport`
→ `scheduler.ts`
→ `AudioContext.currentTime` look-ahead grid
→ `scheduleTickAt()`
→ `triggerPart()`
→ central `voiceAllocator`
→ sample / 3D Synth / 3D Bass / legacy synth / hybrid branch
→ per-part `chain.input`
→ HP / LP / drive / EQ / volume / pan
→ dry + FX buses
→ `masterIn`
→ master EQ
→ stereo width
→ soft clip
→ master gain
→ limiter
→ `AudioContext.destination`

The WebAudio `setInterval` wakes the scheduler but is not itself the musical timestamp source.

## 8. Timing-domain warning

Three tick representations exist:

- browser `masterClock.tick = beat * 24`
- browser scheduler `globalTick/songTicks` = sixteenth-note counters
- native `VibeCoreSync` = PPQ 1920, 480 ticks per sixteenth

These domains must never be passed through a generic `tick: number` contract without an explicit unit/domain type.

Recommended future types after Gate B0 completes:

- `MidiClockTick24PPQ`
- `SongStep16th`
- `NativeMusicalTick1920PPQ`
- or a single canonical `MusicalPosition` with explicit conversion functions

No conversion refactor is authorized yet; first complete the graph proof.

## 9. Verification status

STATICALLY VERIFIED:
- host bridge injection
- AudioBackend → NativeOboeBackend
- native runtime startup binding
- TS narrow bridge → Kotlin for lifecycle/transport/voice subset
- Kotlin → JNI → C++ for inspected methods
- C++ engine → Oboe callback
- callback → sync → graph → voices/DSP → output
- browser scheduler → triggerPart → WebAudio master chain

UNKNOWN / NOT EXECUTED:
- complete Groove-state mirroring into native engine
- every large Kotlin bridge method has an active TS caller
- real APK/device runtime behavior
- duplicate-trigger absence at runtime
- latency, xRuns, jitter, CPU, RAM, callback budget
