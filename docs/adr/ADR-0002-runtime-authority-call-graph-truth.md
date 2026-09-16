# ADR-0002 — Runtime Authority & Call-Graph Truth

Status: ACCEPTED AS PRECONDITION
Date: 2026-09-16

## Context

The v4.0 architecture requires one authoritative audio/runtime path and one authoritative musical timebase. Existing source and documentation strongly suggest this target, but target architecture is not runtime proof.

The repository currently contains browser WebAudio code, an `AudioBackend` contract, `NativeOboeBackend`, `nativeAudioRuntime`, an Android `@JavascriptInterface` bridge, JNI, C++ engine code, Oboe stream code, Groove/Bass/Voice engines, and a browser-side `masterClock`.

Historical reports also mention possible duplicate or parallel paths such as `engine.ts`, `trigger.ts`, `voiceEngine.ts`, `types.ts`, and preset/runtime helpers. Those historical claims are not accepted as current truth until re-proven against the current HEAD.

## Decision

No runtime migration, consolidation refactor, scheduler rewrite, backend replacement, Sample/Synth runtime migration, or timing ownership change may proceed until the current call graph is statically proven end to end.

The audit must establish, with source-level evidence:

1. Exact `AudioBackend` contract.
2. Every implementation of that contract.
3. Every instantiation of `NativeOboeBackend`.
4. Every invocation/use of `nativeAudioRuntime`.
5. TypeScript → Kotlin bridge mapping, method by method.
6. Kotlin → JNI symbol mapping.
7. JNI → C++ engine method mapping.
8. C++ → `oboe::AudioStream` / data callback ownership.
9. Audio callback → mixer/DSP → output path.
10. Full `masterClock.ts` ownership and consumers.
11. Scheduler creation and lifecycle.
12. Scheduler → trigger connection.
13. Trigger → voice allocation / voice start.
14. Voice → audio runtime / DSP path.
15. Repository-wide timing scan of `setInterval`, `setTimeout`, `requestAnimationFrame`, `Date.now`, `performance.now`, and native clock APIs, classified into UI-only, diagnostics, scheduling, musical timing, or unsafe/unknown.

## Verification rule

Documentation, comments, naming and architecture diagrams are evidence of intent only. They are not sufficient proof of runtime realization.

The existing E2E simulation matrix is an input to verification but does not prove the native call graph, callback ownership, timing authority, latency, xRuns, or real device behavior.

## Performance status

Until executed measurements exist:

- CPU: `UNKNOWN`
- RAM: `UNKNOWN`
- XRuns: `UNKNOWN`
- Jitter: `UNKNOWN`
- Latency: `UNKNOWN`
- Callback execution budget: `UNKNOWN`

The configured/native target values may be documented as configuration only and must not be presented as measured performance.

## UX scope

No UX redesign is part of this ADR. This audit is architecture/runtime-only. Its goal is to determine whether live actions actually converge on one authoritative audio path and one authoritative sync path.

## Risk

The primary risk is false certainty: declaring `ONE AUDIO AUTHORITY` or `ONE MASTER CLOCK` based on intended architecture while a live parallel path still exists.

## Consequence

Revision order changes. Runtime Authority Audit becomes Gate B0 and blocks destructive/runtime-affecting migration work.

## Exit criteria

This ADR gate is complete only when:

- the static call graph is documented end to end,
- ambiguous/parallel paths are classified,
- missing links are explicitly marked `UNKNOWN`,
- contract/null/timing tests are defined against the observed graph,
- no performance or runtime result is claimed without execution evidence.
