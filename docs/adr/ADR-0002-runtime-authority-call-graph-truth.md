# ADR-0002 — Runtime Authority & Call-Graph Truth

Status: ACTIVE — STATIC GRAPH PARTIALLY PROVEN
Date: 2026-09-16

## Context

The v4.0 architecture requires one authoritative audio/runtime path and one authoritative musical timebase. Existing source and documentation strongly suggest this target, but target architecture is not runtime proof.

The repository contains browser WebAudio code, an `AudioBackend` contract, `NativeOboeBackend`, `nativeAudioRuntime`, Android `@JavascriptInterface`, JNI, C++ engine code, Oboe, Groove/Bass/Voice engines, browser `masterClock`, and a browser look-ahead scheduler.

Historical duplicate-path claims are not accepted unless re-proven against current HEAD.

## Decision

No runtime migration, consolidation refactor, scheduler rewrite, backend replacement, Sample/Synth runtime migration, or timing ownership change may proceed until the observed call graph is documented and the remaining unknowns are explicit.

## Proven static graph

Current source proves the Native path:

```text
Index.tsx startup
→ bindNativeAudioRuntime()
→ nativeAudioRuntime
→ createAudioBackend()
→ NativeOboeBackend
→ window.VibeCoreNative
→ NativeAudioBridge.kt
→ JNI bridge
→ VibeCoreAudioEngine
→ Oboe DataCallback
→ VibeCoreSync
→ AudioGraphManager
→ GrooveNode / BassNode / VoiceNode
→ voice/DSP processing
→ leaf AudioBus mix
→ final Float output buffer
→ Oboe stream
```

The browser scheduler is also installed at startup, but its transport subscriber exits before scheduler start whenever `isNativeAudioPath()` is true. This provides static evidence against simultaneous browser/native transport scheduling.

## Proven native callback ordering

`VibeCoreAudioEngine::onAudioReady()` performs:

```text
command drain
→ VibeCoreSync callback processing
→ sync-event dispatch
→ AudioGraph process
→ master gain
→ latency sample
→ sample-position advance
```

`GrooveNode` receives native tick events, runs `StepSequencer`, fills a trigger queue, then routes triggers to its sample VoicePool, `BassNode`, or `VoiceNode` before the instrument nodes render in the same callback.

## Timing-domain finding

At least three timing representations exist:

1. browser `masterClock`: `tick = beat * 24`
2. browser scheduler: `globalTick` / `songTicks` in sixteenth-note steps
3. native `VibeCoreSync`: PPQ 1920; one sixteenth = 480 native ticks

This is a contract concern. Coexistence is acceptable only if units and conversion boundaries are explicit and tested. Raw `tick` values must never be silently interchangeable across these domains.

## Browser scheduler classification

Browser scheduling uses `window.setInterval` only as wake-up. Actual musical event timestamps are based on `AudioContext.currentTime`, `nextTickTime` and look-ahead scheduling.

`masterClock` uses `requestAnimationFrame` for subscriber notification, not for audio scheduling.

Known `performance.now` and `Date.now` usages in the scheduler are diagnostic/UI throttling, not the audio timebase.

## Verification rule

Documentation, comments, naming and architecture diagrams are evidence of intent only. They are not sufficient proof of runtime realization.

The existing E2E simulation matrix is an input to verification but does not prove callback ownership, bridge selection, timing authority, latency, xRuns or real-device behavior.

## Performance status

Until executed measurements exist:

- CPU: `UNKNOWN`
- RAM: `UNKNOWN`
- XRuns: `UNKNOWN`
- Jitter: `UNKNOWN`
- Latency: `UNKNOWN`
- Callback execution budget: `UNKNOWN`

Configured values are configuration only, not measurements.

## Remaining mandatory audit work

- complete method-by-method TypeScript → Kotlin mapping
- complete Kotlin native declaration → JNI mapping
- complete caller inventory for the larger Groove/Bass/Voice Kotlin surface
- complete repository-wide timing API classification
- trace browser `triggerPart()` through WebAudio voice/DSP to output
- trace Bass native trigger/voice/DSP path to output
- prove all tick-domain conversions
- define contract/null/timing tests against the observed graph
- execute Native Android runtime evidence later

## Risk

Primary risk remains false certainty: `ONE AUDIO AUTHORITY` and `ONE MASTER CLOCK` are now strongly supported statically, but are still not runtime `VERIFIED`.

## Exit criteria

This ADR gate is complete only when:

- static call graph is documented end to end,
- ambiguous/parallel paths are classified,
- missing links are marked `UNKNOWN`,
- contract/null/timing tests are defined,
- tick-domain conversions are explicit,
- no performance/runtime result is claimed without execution evidence.
