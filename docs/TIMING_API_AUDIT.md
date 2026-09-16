# VibeCoreLiv3 — Timing API Audit

Stand: 2026-09-16
Basis: current main HEAD `308ae3849ca5bbce9142252f660e4bc2bc870672`
Status: STATICALLY VERIFIED / IN PROGRESS

## Rule

Timing APIs are classified by role. A timer API is not automatically wrong; it becomes an architecture problem when it acts as an independent musical authority beside VibeCore Sync/MasterClock.

## Current classifications

| File / subsystem | API / source | Role | Classification |
|---|---|---|---|
| `src/lib/audio/scheduler.ts` | `setInterval` | wakes WebAudio look-ahead scheduler | CONDITIONAL / allowed only browser path |
| `src/lib/audio/scheduler.ts` | `AudioContext.currentTime` | timestamps musical WebAudio events | MUSICAL AUDIO TIME |
| `src/lib/audio/scheduler.ts` | `performance.now` / `Date.now` | diagnostics/playhead write throttling | NON-AUTHORITY |
| `src/lib/clock/masterClock.ts` | `requestAnimationFrame` | subscriber notification | OBSERVER / UI-CONTROL RATE |
| `src/lib/audio/modulation.ts` | `requestAnimationFrame` | modulation control-rate loop | CONTROL RATE — REVIEW REQUIRED |
| `src/lib/audio/modulation.ts` | `AudioContext.currentTime` | phase source for free LFO/ENV calculations | AUDIO TIME — NOT MASTER PHASE |
| `src/lib/audio/granular.ts` | `AudioContext.currentTime` | schedules continuous grains/freeze seams | AUDIO TEXTURE SCHEDULING |
| `src/lib/audio/engine.ts` | `setTimeout` | delayed cleanup/release bookkeeping | NON-AUTHORITY |
| `src/lib/audio/brainwave.ts` | `masterClock.subscribe` | updates SYNC/HYBRID modulation rate | MASTER-CLOCK DERIVED |
| `src/lib/audio/brainwave.ts` | oscillator node time | actual oscillator execution | AUDIO DSP |
| `src/lib/clock/sources/midiSync.ts` | `AudioContext.currentTime` | MIDI clock timestamp + MasterClock phase/tempo update | EXTERNAL SYNC INPUT TO AUTHORITY |
| Native `VibeCoreSync` | callback sample position | native tick/beat/bar scheduling | NATIVE MUSICAL AUTHORITY |
| Native `VoiceEngine` | `std::chrono` | bounded UI-side sample retirement wait | NON-MUSICAL |

## Important finding — modulation runtime

`src/lib/audio/modulation.ts` runs its control loop from `requestAnimationFrame` and sets:

```text
t = AudioContext.currentTime
LFO1 = sin(2π * 0.5 * t)
LFO2 = sin(2π * 0.25 * t + phase)
ENV1/ENV2 = functions of t and BPM
```

This is acceptable for deliberately FREE modulation.

It is NOT sufficient proof for synchronized LFO/ENV behavior required to follow one musical authority, because the phase is derived directly from AudioContext time instead of MasterClock/VibeCoreSync musical phase.

Status:

- free-running modulation: `STATICALLY PLAUSIBLE`
- sync-authoritative modulation: `NOT PROVEN / CONTRACT GAP`

Required change after Gate B0:

- explicit `FREE | SYNC` modulation timing mode,
- SYNC phase derived from the authoritative clock,
- no hidden BPM-derived phase loop running independently.

## Granular runtime

Granular/freeze uses `AudioContext.currentTime` to schedule texture grains and seam fades. This is audio scheduling, but it is not currently the beat-grid/transport authority.

Classification: `AUDIO TEXTURE SCHEDULING`.

However, because `ensureAudio()` creates a WebAudio graph, Native Android must prove that granular WebAudio cannot become an unintended parallel audible render path when Oboe Native is selected.

## bRAINWAVEz

`brainwave.ts` has FREE, SYNC and HYBRID modes.

- FREE: local oscillator rates are independent by design.
- SYNC: rate derives from `masterClock.getState().bpm` + musical division.
- HYBRID: phase LFO follows the MasterClock-derived division while carrier/beat remain free.

This is a much clearer timing contract than generic modulation.

## MIDI Sync

`midiSync.ts` intentionally timestamps incoming 24-PPQ MIDI Clock using `AudioContext.currentTime` and writes tempo/source/phase into `masterClock`; transport commands go through Store actions.

This is an external source feeding the authority, not a second DSP scheduler.

## Remaining timer audit

A complete repository-wide token enumeration is still pending because connected GitHub code search currently returns incomplete/no results for generic timing tokens. Therefore this document does not claim exhaustive coverage yet.

Must still inspect at least:

- quality/performance monitors
- main-thread monitor
- meter loops
- audio clock probe
- setup latency/clock tests
- synth3d/bass3d voices
- Sample Forge loop/recorder paths
- Remix live/input paths
- UI components with recurring timers
- Android/JNI/system clock functions

## Exit condition

Gate B0 cannot close until every musically relevant timer is one of:

1. authoritative clock,
2. derived from authoritative clock,
3. audio-render scheduling under that authority,
4. explicitly FREE/non-synced behavior,
5. UI/diagnostic/lifecycle only.

Anything else remains `UNKNOWN` or `CONFLICT`.
