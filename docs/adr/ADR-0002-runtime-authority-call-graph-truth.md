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
- `PerformanceTab` always initializes/resumes WebAudio before toggling transport, unlike the backend-aware `TopBar`.
- Sample Forge preview and slice audition render directly through WebAudio.
- Forge audition renders through WebAudio preview.
- bRAINWAVEz and Quantum Spatial create audible WebAudio graphs directly.
- generic modulation/granular subsystems are browser-runtime implementations.
- the narrow `AudioBackend` currently has a native concrete implementation, while browser audio bypasses that interface.
- `nativeAudioRuntime` proves transport/tempo/gain/seek mirroring, but no Store → Native Groove project-state mirror has yet been proven.
- Voice UI caller mapping into the larger native Voice bridge remains incomplete.

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

## Required implementation consequences

1. Create a backend-neutral Runtime facade before migrating UI call sites.
2. Add a browser runtime adapter around the existing WebAudio implementation; do not build a second browser engine.
3. Extend the native adapter/runtime surface only where required by proven feature commands.
4. Implement explicit Store → Native project mirroring for Pattern/Scene/Step/Notes/Routing if no existing caller is found.
5. Route TopBar and Performance transport through the same RuntimeTransport API.
6. Route InstrumentKeyboard through PerformanceInput with explicit noteOn/noteOff/allNotesOff lifecycle.
7. Route Sample Forge/Forge audible previews through RuntimePreview while leaving decode/offline transforms in AudioAssetService.
8. Capability-route bRAINWAVEz, Spatial, granular and other audible auxiliary engines; they may not silently start WebAudio in Native mode.
9. Introduce explicit timing unit types/converters for Beat, Clock24Tick, SixteenthStep and NativePpq1920Tick.
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
