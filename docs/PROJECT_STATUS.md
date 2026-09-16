# VibeCoreLiv3 — Project Status

Stand: 2026-09-16

## Canonical engineering source

The normative engineering specification is:

`docs/VibeCore_Univers_SUPREME_MasterPrompt_UNIFIED_v4.0.md`

Older prompts, handovers, statistics and validation reports are historical or supporting material unless explicitly marked otherwise.

## Current phase

**RUNTIME CONSOLIDATION & UX PERFORMANCE REVISION**

The project is no longer treated as a UI prototype. It contains a substantial React/Vite application, musical domain/state model, Android WebView/native bridge path and native C++/Oboe audio platform. The current work is therefore consolidation, contract alignment, performance work and verification rather than broad feature expansion.

## Runtime authority stop-gate

Before runtime-affecting migration/refactoring, `ADR-0002 — Runtime Authority & Call-Graph Truth` must be completed.

The revision must first prove the actual current-HEAD chain:

`TypeScript → AudioBackend/nativeAudioRuntime → Kotlin bridge → JNI → C++ engine → Oboe callback → Mixer/DSP → Output`

and independently prove:

`masterClock / native sync → scheduler → trigger → voice allocation/start → DSP/runtime`.

All browser/native timer and clock APIs must be classified for musical timing use.

Target architecture such as `ONE AUDIO AUTHORITY` and `ONE MASTER CLOCK` is not considered runtime proof.

## Verified by current repository structure

Status terminology follows the v4.0 MasterPrompt.

- `AudioBackend` interface exists — `STATICALLY VERIFIED`
- `NativeOboeBackend implements AudioBackend` — `STATICALLY VERIFIED`
- No concrete `WebAudioBackend implements AudioBackend` exists; browser fallback uses `engine.ts` directly — `STATICALLY VERIFIED`
- `nativeAudioRuntime.ts` binds backend tempo/gain/transport/seek state — `STATICALLY VERIFIED`
- `Index.tsx` invokes both native-runtime binding and browser scheduler binding on app mount — `STATICALLY VERIFIED`
- Browser scheduler explicitly refuses to start when `isNativeAudioPath()` is true — `STATICALLY VERIFIED`
- Android `MainActivity.kt` injects `NativeAudioBridge` exactly as `window.VibeCoreNative` — `STATICALLY VERIFIED`
- Kotlin bridge loads `vibecore-native` and exposes lifecycle/transport/groove/bass/voice methods — `STATICALLY VERIFIED`
- inspected Kotlin → JNI → C++ lifecycle/transport/voice mappings exist — `STATICALLY VERIFIED`
- `VibeCoreAudioEngine::onAudioReady()` is the Oboe data callback and executes command queue → native sync → graph event dispatch → graph render → master gain → output — `STATICALLY VERIFIED`
- Native Groove step path reaches `StepSequencer → TriggerQueue → GrooveNode → VoicePool/BassNode/VoiceNode` — `STATICALLY VERIFIED`
- Browser scheduler reaches `scheduleTickAt() → triggerPart() → voiceAllocator → WebAudio part/master graph → AudioContext.destination` — `STATICALLY VERIFIED`
- Central application state/store exists — `STATICALLY VERIFIED`
- Capability Registry exists at `src/lib/capabilities/registry.ts` — `STATICALLY VERIFIED`
- AI learning consent/profile implementation exists — `STATICALLY VERIFIED`
- E2E simulation matrix exists — `STATICALLY VERIFIED`

## Important runtime-contract findings

### Backend asymmetry

`AudioBackend.ts` describes WebAudio and native as backend concepts, but only `NativeOboeBackend` implements the interface. Browser operation uses the direct `engine.ts` runtime instead of a concrete `WebAudioBackend` adapter.

This is an architecture asymmetry, not yet a refactor authorization.

### Native bridge surface is wider than AudioBackend

Kotlin exposes native Groove, Scene, Piano Roll, Bass and Voice APIs that are not all part of `VibeCoreNativeBridge` / `AudioBackend`.

### Groove-state mirroring remains unresolved

The native Groove engine and bridge setters are real. The narrow AudioBackend/nativeAudioRuntime path currently proves transport/tempo/gain/seek, but does not itself prove that Zustand Pattern/Scene/Step/Piano-Roll state is mirrored into native GrooveEngine before playback.

Until an exact TypeScript caller chain for the Kotlin `groove*` bridge methods is found, native Groove project-state synchronization remains `UNKNOWN` and release-blocking.

### Timing domains

At least three timing units are present:

- Browser `masterClock.tick`: 24 ticks per beat
- Browser scheduler `globalTick/songTicks`: sixteenth-note counters
- Native `VibeCoreSync`: PPQ 1920 / 480 ticks per sixteenth

These may coexist only with explicit conversion/domain ownership. Generic untyped `tick` interchange is unsafe.

## Runtime facts not yet proven

- complete TypeScript caller coverage for the large Kotlin Groove/Bass/Voice bridge surface — `UNKNOWN`
- Groove/Pattern/Piano-Roll state mirroring into native engine — `UNKNOWN`
- complete repository-wide timer/clock classification — `PARTIAL / UNKNOWN`
- real-device absence of duplicate triggers — `NOT EXECUTED`
- real APK/device callback behavior — `NOT EXECUTED`
- single-master-clock realization under actual Android runtime — `NOT EXECUTED`

## Known architecture gaps / conflicts

- Authoritative Parameter Hub — `PARTIAL / GAP`
- Capability Registry — `EXISTS / STATICALLY VERIFIED`; adoption as sole availability authority still incomplete
- Sample/Synth instrument boundary currently conflicts with v4.0 sample-slot integrity — `CONFLICT`
- AI Intent → Validation → Command/Parameter boundary is only partially centralized — `PARTIAL`
- Runtime backend access is not yet uniformly represented by one frontend backend contract — `PARTIAL`
- Motion Step Recorder as an end-to-end central capability — `PARTIAL / UNKNOWN`
- Remix live audio input / device playback capture — `PARTIAL / UNKNOWN`

## Performance truth

No performance values are claimed before measurement.

- CPU — `UNKNOWN`
- RAM — `UNKNOWN`
- XRuns — `UNKNOWN`
- Jitter — `UNKNOWN`
- Latency — `UNKNOWN`
- Callback budget — `UNKNOWN`

Configured target values are configuration evidence only, not performance measurements.

## Verification status

The presence of scripts or test plans is not considered proof of successful execution.

For the current revision branch, the following remain `NOT EXECUTED` until concrete evidence is recorded:

- typecheck
- lint
- unit tests
- web build
- Android web build
- native/Gradle build
- APK install and launch
- live Android E2E matrix
- audio latency/xRun measurements
- CPU/thermal profiling
- reference-audio/DSP quality verification

## Revision order

1. Truth/documentation baseline
2. Runtime Authority & Call-Graph Truth audit — **current gate**
3. Sample/Synth boundary migration design and implementation
4. Runtime contract
5. Capability Registry adoption/hardening
6. Parameter Hub
7. Caching layer
8. React/UI performance revision
9. Android/native performance revision
10. Handling/usability revision
11. AI Intent + Motion Recorder consolidation
12. Remix live-input path
13. Full E2E/performance verification

## Release rule

Do not call the project `COMPLETE`, `VERIFIED` or production-ready until the applicable v4.0 Definition of Done and executed verification gates are satisfied.
