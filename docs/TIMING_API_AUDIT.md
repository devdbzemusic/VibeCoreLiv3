# VibeCoreLiv3 — Timing API Audit

Stand: 2026-09-16
Basis: current main HEAD `308ae3849ca5bbce9142252f660e4bc2bc870672`
Status: STATICALLY VERIFIED / IN PROGRESS

## Rule

Timing APIs are classified by role. A timer API is not automatically wrong; it becomes an architecture problem when it acts as an independent musical authority beside VibeCore Sync/MasterClock.

A second distinction is now mandatory:

- timing source,
- audible runtime/render entry,
- decode/analysis-only AudioContext use.

A browser `AudioContext` used only for decoding a file is not automatically a competing renderer; a browser `AudioContext` used to trigger audible voices on Native Android is an authority conflict.

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
| `InstrumentKeyboard.tsx` | `AudioContext.currentTime` | immediate live note trigger into `triggerPart` | AUDIBLE WEB RUNTIME ENTRY / CONFLICT ON NATIVE |
| `SmplTab.tsx` | `ensureAudio` + `previewBuffer` / `triggerSampleRegion` | audible sample preview/slice audition | AUDIBLE WEB RUNTIME ENTRY / CONFLICT ON NATIVE |
| `SmplTab.tsx` | `ensureAudio` + decode/edit buffer operations | file decode/edit | AUDIO DECODE/EDIT — NOT OUTPUT AUTHORITY BY ITSELF |
| `RemixTab.tsx` | `ensureAudio` + `decodeAudioData` | file decode before BPM/key/energy analysis | AUDIO DECODE/ANALYSIS — NOT OUTPUT AUTHORITY BY ITSELF |
| `Bass3DPage.tsx` | `Date.now()` | AI bassline seed | NON-MUSICAL RANDOM SEED |
| `RemixTab.tsx` | `Date.now()` | AI structure/remix seed | NON-MUSICAL RANDOM SEED |
| `RemixTab.tsx` | `setTimeout` | long-press UX detection | UI GESTURE TIMER |
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

## Live Instrument timing

`InstrumentKeyboard.tsx` is now a confirmed direct WebAudio performance path:

```text
pointerDown
→ ensureAudio()
→ getCtx()
→ ctx.currentTime
→ triggerPart(partId, ctx.currentTime, ...)
```

Both `Synth3DPage.tsx` and `Bass3DPage.tsx` embed this keyboard.

Therefore the musical timestamp for live 3D Synth/Bass interaction currently comes from the browser AudioContext rather than from a backend-neutral input/runtime contract.

On browser this may be a valid low-latency immediate-note path.

On Native Android it remains an authority conflict until routed to the Native backend or explicitly suppressed.

## Sample Forge timing/render classification

`SmplTab.tsx` uses browser audio for several different purposes which must not be conflated:

### Decode/edit

- sample decode,
- AudioBuffer transforms,
- normalization,
- reverse,
- trim/fade/pitch/stretch/freeze rendering.

These can remain an analysis/edit service if they do not own audible output.

### Audible audition

- `previewBuffer`,
- `triggerSampleRegion`,
- any direct `triggerPart` audition.

These are audible runtime commands and must route through the selected Runtime on Native.

## Remix timing classification

`RemixTab.tsx` calls `ensureAudio()` to decode a user-selected file before PCM analysis.

Observed path:

```text
file.arrayBuffer
→ AudioContext.decodeAudioData
→ bufferToPCM
→ analyzeRemixAudioInput
```

No audible render call is proven in that file-analysis path.

Classification: `AUDIO DECODE/ANALYSIS`, not a second scheduler.

`setTimeout` in Remix is used for long-press gesture recognition and is therefore UI-only.

`Date.now()` is used as an AI/generative seed and is not a musical playback clock.

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

It is still an audible browser-engine module and therefore needs render-authority gating on Native separately from its clock correctness.

## MIDI Sync

`midiSync.ts` intentionally timestamps incoming 24-PPQ MIDI Clock using `AudioContext.currentTime` and writes tempo/source/phase into `masterClock`; transport commands go through Store actions.

This is an external source feeding the authority, not a second DSP scheduler.

## Runtime startup observation

`Index.tsx` installs both native/runtime and browser-engine-side bindings:

```text
bindNativeAudioRuntime()
bindInternalSource()
initSchedulerBindings()
bindParamUpdates()
startQualityManager()
```

The browser transport scheduler has a proven Native exclusion guard.

The WebAudio parameter binding is still installed globally. This is not proof that it starts audio, but must be covered by a Native test proving it cannot create or drive an unintended audible browser graph.

## Remaining timer/render audit

A complete repository-wide token enumeration is still pending because connected GitHub code search currently returns incomplete/no results for generic timing tokens. Therefore this document does not claim exhaustive coverage yet.

Must still inspect at least:

- quality/performance monitors
- main-thread monitor
- meter loops
- audio clock probe
- setup latency/clock tests
- synth3d/bass3d voice internals beyond shared keyboard
- Sample Forge recorder/loop internals
- Voice live-input callers
- Performance/Forge preview paths
- UI components with recurring timers
- Android/JNI/system clock functions

## Exit condition

Gate B0 cannot close until every musically relevant timer/render entry is one of:

1. authoritative clock,
2. derived from authoritative clock,
3. audio-render scheduling under the selected runtime authority,
4. explicitly FREE/non-synced behavior,
5. decode/analysis only,
6. UI/diagnostic/lifecycle only.

Anything else remains `UNKNOWN` or `CONFLICT`.
