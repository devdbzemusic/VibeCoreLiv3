# ADR-0002 — Runtime Authority & Call-Graph Truth

Status: ACCEPTED FOR STATIC ARCHITECTURE / RUNTIME VERIFICATION OPEN
Date: 2026-09-16
Basis HEAD: `308ae3849ca5bbce9142252f660e4bc2bc870672`

## Context

VibeCore v4 requires one authoritative audible runtime and one authoritative musical timing source per active runtime. The current repository contains both a WebAudio implementation and a native Android/Oboe implementation. The audit goal was to distinguish source-proven call edges from intended architecture.

Historical duplicate-path claims are not accepted unless re-proven against current HEAD.

## Static evidence

The native audio chain is source-proven end to end:

```text
Index.tsx
→ bindNativeAudioRuntime()
→ nativeAudioRuntime
→ AudioBackend
→ NativeOboeBackend
→ window.VibeCoreNative
→ NativeAudioBridge.kt
→ JNI
→ VibeCoreAudioEngine
→ oboe::AudioStream DataCallback
→ VibeCoreSync
→ AudioGraphManager
→ Groove/Bass/Voice nodes
→ DSP / Voice pools
→ final Float output buffer
→ Oboe stream
```

`VibeCoreAudioEngine::onAudioReady()` performs command drain, sync processing, sync-event dispatch, graph render, master gain, diagnostics and sample-position advance in the callback path.

The browser path is separately source-proven:

```text
Store transport
→ browser scheduler
→ setInterval wake-up
→ AudioContext.currentTime look-ahead
→ scheduleTickAt
→ triggerPart
→ voice allocation
→ sample / synth / bass / hybrid path
→ part DSP
→ FX/master chain
→ AudioContext.destination
```

The browser scheduler contains a native-path guard and therefore does not intentionally start when `isNativeAudioPath()` is true.

## Critical findings

The current application does NOT yet have one universal frontend audio command entry point.

Static conflicts found:

- `InstrumentKeyboard` calls `ensureAudio()` and `triggerPart()` directly. 3D Synth and 3D Bass both use this component.
- Sample Forge preview and slice audition render directly through WebAudio.
- Forge audition renders through WebAudio preview.
- bRAINWAVEz and Quantum Spatial create audible WebAudio graphs directly.
- generic modulation/granular subsystems are browser-runtime implementations.
- the narrow `AudioBackend` currently has a native concrete implementation, while browser audio bypasses that interface.
- Voice UI caller mapping into the larger native Voice bridge remains incomplete.

Already corrected on the revision branch:

- TopBar and Performance transport now route through the same frontend `toggleRuntimePlay()` entry point.
- Native seek no longer uses an unexplained raw `480`; sixteenth-step to Native PPQ conversion is explicit and typed.
- Runtime timing units now distinguish Beat / Clock24Tick / SixteenthStep / NativePpq1920Tick.
- `VibeCoreNativeBridge` exposes only statically proven Groove methods needed by the first ProjectMirror slice.
- `projectMirror.ts` implements a bounded Current-Scene mirror for 16 Native Groove tracks with explicit semantic conversion for swing, ratchet and micro-timing.
- Native `GrooveEngine` now contains a project-load guard capable of suppressing undo snapshots during authoritative hydration; Kotlin/JNI exposure of that guard is still OPEN.

Therefore:

`browser scheduler excluded` does NOT imply `single audible renderer proven`.

## Timing truth

At least three timing representations are source-proven:

1. Browser MasterClock: `tick = beat * 24`
2. Browser scheduler: `globalTick/songTicks` as sixteenth-note counters
3. Native VibeCoreSync: PPQ 1920, 480 ticks per sixteenth

These are different units. They may coexist only behind explicit typed conversions.

Known timer classifications:

- browser `setInterval`: scheduler wake-up only
- `AudioContext.currentTime`: browser audio scheduling time
- `masterClock` `requestAnimationFrame`: subscriber/UI notification
- `modulation.ts` `requestAnimationFrame`: control-rate loop; synchronized phase contract incomplete
- MIDI Clock: feeds MasterClock using audio-time timestamps
- bRAINWAVEz SYNC/HYBRID: derives rate from MasterClock
- Quantum Spatial SYNC: derives synchronized parameters from MasterClock, but its audible renderer is WebAudio
- `audioClockProbe`: diagnostic AudioWorklet/ScriptProcessor probe, not musical authority
- `audioPerf`: metrics collector, not musical authority
- UI `setTimeout`/`Date.now`: gesture/debounce/random-seed cases found, not beat-grid authority

## Decision

The target runtime authority is fixed as follows.

### Android Native mode

When native capability is selected and available:

```text
Native Oboe Runtime = sole authoritative audible renderer
Native VibeCoreSync = sole authoritative real-time musical scheduler
```

No UI feature may directly create an audible WebAudio render path in this mode unless an explicit, documented capability exception exists.

Browser WebAudio may still be used for non-audible decode, offline transform, analysis, waveform preparation or caching.

### Browser/Web mode

When native audio is unavailable/not selected:

```text
WebAudio Runtime = sole authoritative audible renderer
MasterClock + browser look-ahead scheduler = browser musical scheduling implementation
```

The logical product authority remains VibeCore Sync; browser MasterClock/scheduler and native VibeCoreSync are platform implementations behind one frontend-facing timing/runtime contract.

### Frontend rule

UI and feature modules must not select or call renderer-specific musical APIs directly.

Required boundary:

```text
UI / Domain Command
→ VibeCoreRuntime
   ├ Transport
   ├ PerformanceInput
   ├ Preview
   ├ ProjectMirror
   ├ Parameters
   └ Diagnostics
→ selected runtime adapter
   ├ WebAudioRuntimeAdapter
   └ NativeAndroidRuntimeAdapter
```

Asset decoding/analysis remains a separate service boundary and is not forced through the audible runtime.

## ProjectMirror v1 contract

The currently proven bridge does not expose a complete 256-Pattern / multi-Scene bank-loader. Therefore ProjectMirror v1 intentionally mirrors only the active Web Pattern/Scene into Native Groove.

Supported in the first bounded slice:

- first 16 parts → Native Groove tracks 0..15
- track mode
- mute / solo / volume
- scene length
- web swing converted from centered `50 = straight` to native `0 = straight`
- step active / velocity / probability / accent
- web ratchet total-hit count → native extra-hit roll count
- web micro timing → Native PPQ tick offset
- Piano Roll note start/end/pitch/velocity

Explicitly NOT mirrored yet:

- project-wide 256-pattern banks
- full 1..8 scene chain
- stable web asset/sample-name → native sampleId assignment
- per-step gate
- per-step filter cutoff
- per-step pan offset
- browser-only auxiliary audible engines

Native Groove has `kMaxTracks = 16`; extra parts must remain visible in project state but cannot silently disappear from a VERIFIED native claim.

### Semantic conversions

Web and Native values are not assumed to be numerically identical.

- Web swing uses `50 = straight`; Native swing uses `0 = straight` and delays odd steps only.
- Web ratchet stores total hits; Native `rollCount` stores extra hits.
- Web micro timing `-50..50` maps to +/-25% of one sixteenth; at Native PPQ 1920 this is `-120..120` ticks.

Negative/pre-beat web swing cannot be represented by the current Native Groove swing field and is clamped to straight with a warning. This remains a contract gap, not a hidden conversion.

## Native bridge correlation status

STATICALLY VERIFIED chains:

```text
grooveSetStep / probability / accent / roll / micro
Kotlin @JavascriptInterface
→ nativeGroove*
→ Java_com_vibecore_audio_NativeAudioBridge_nativeGroove*
→ GrooveEngine
→ GrooveNode command queue
```

```text
bassSet* / bassNoteOn/Off
Kotlin @JavascriptInterface
→ nativeBass*
→ jni_bass_bridge.cpp
→ BassEngine
→ BassNode command queue
```

```text
voiceSet* / voiceNoteOn/Off / voiceLoadSample / live input
Kotlin @JavascriptInterface
→ nativeVoice*
→ jni_voice_bridge.cpp
→ VoiceEngine
→ VoiceNode command queue
```

The C++ `GrooveEngine` project-load guard is implemented, but its Kotlin/JNI bridge hooks are not yet exposed. Automatic ProjectMirror hydration therefore remains intentionally DISABLED until this last marshalling hook exists; otherwise hydration would pollute Native undo history.

## Required implementation consequences

1. Complete Kotlin/JNI exposure of `beginProjectLoad()` / `endProjectLoad()` and then wrap ProjectMirror replay in `try/finally`.
2. Activate Current-Scene ProjectMirror during native startup only after the bulk-load guard is reachable from JS.
3. Create a backend-neutral Runtime facade before migrating remaining UI call sites.
4. Add a browser runtime adapter around the existing WebAudio implementation; do not build a second browser engine.
5. Extend the native adapter/runtime surface only where required by proven feature commands.
6. Route InstrumentKeyboard through PerformanceInput with explicit noteOn/noteOff/allNotesOff lifecycle.
7. Route Sample Forge/Forge audible previews through RuntimePreview while leaving decode/offline transforms in AudioAssetService.
8. Capability-route bRAINWAVEz, Spatial, granular and other audible auxiliary engines; they may not silently start WebAudio in Native mode.
9. Expand ProjectMirror only through explicit contracts for Pattern/Scene banks, sample asset IDs and parameter ownership.
10. Add contract/null/timing tests before removing legacy direct paths.

## What remains UNKNOWN / NOT EXECUTED

This ADR accepts the static architecture decision only. It does not claim runtime success.

Still required on a real Android runtime:

- APK build/install/launch
- bridge availability at startup
- native library load
- actual Oboe stream open/start
- callback activity
- Store → Native Groove state transfer
- audible exact pattern reproduction
- no parallel audible WebAudio renderer
- device/focus recovery
- latency measurement
- xRuns
- jitter
- CPU
- RAM
- callback duration/budget

Performance status remains:

- CPU: `UNKNOWN`
- RAM: `UNKNOWN`
- XRuns: `UNKNOWN`
- Jitter: `UNKNOWN`
- Latency: `UNKNOWN`
- Callback duration: `UNKNOWN`

## Verification rule

`VERIFIED` may only be used for executed evidence. Static source proof remains `STATICALLY VERIFIED`. Runtime results remain `NOT EXECUTED` until actually run.

## Migration safety

Implementation must be incremental and reversible. Existing engines are reused behind adapters. No second scheduler, second authoritative store or parallel parameter system may be introduced.
