---
name: SonicArchitect architecture
description: Key invariants for the SonicArchitect (VibeCoreLiv3) DAW engine that must never be broken.
---

# SonicArchitect Architecture Invariants

## Rule: Single AudioContext — never create a second one
The engine singleton in `src/lib/audio/engine.ts` owns the one-and-only `AudioContext`. Creating a second context causes click artifacts and voice allocation drift.
**Why:** Web Audio allows at most one active context per user gesture. A second context silently suspends the first in Safari and some Chrome versions.
**How to apply:** Any code that needs a context must call `ensureAudio()` (exported from engine.ts) and use the returned context. Never call `new AudioContext()` outside of engine.ts.

## Rule: MasterClock is the only timing authority
All time-sensitive sources (internal metronome, MIDI clock, adaptive sync) write through `masterClock` in `src/lib/clock/masterClock.ts`. The scheduler (`src/lib/audio/scheduler.ts`) reads from MasterClock only.
**Why:** Multiple timing sources writing AudioParam schedules independently cause phase drift and double-triggering.
**How to apply:** New sync sources must implement the `ClockSource` interface and call `masterClock.setSource()`; they must not call `scheduler.step()` or touch AudioParams directly.

## Rule: bindParamUpdates() is the only store→AudioParam bridge
The function exported from `src/lib/audio/engine.ts` subscribes to the Zustand store and calls `applyAllParams()` on relevant changes. All store audio-param watchers must live here.
**Why:** Avoids 60Hz churn from React renders hitting AudioParams. Reference-equality guards inside the subscription prevent no-op updates.
**How to apply:** When adding a new store field that controls audio, add its watcher to `bindParamUpdates()`.

## Rule: Forge uses offline-render → slot assign, NOT live graph patching
`renderPresetToAudioBuffer()` in `src/lib/forge/render.ts` renders into an OfflineAudioContext. The result is assigned to a part slot via `assignBufferToPart()`. The live engine plays it via the normal sample playback path.
**Why:** Live graph patching during playback causes clicks and race conditions with the scheduler.

## Rule: FxMixLab insert chains are real DSP nodes; bus routing is a data model
`src/lib/fxmixlab/insertChain.ts` wires real AudioNodes between `chain.input` and `chain.hp`. Bus routing topology lives in `src/lib/fxmixlab/routing.ts` as a pure data model. The engine applies it via `applyFxMixLabRouting()` / `routePartMainToBus()` / `setBusChannelLevel()` (added in initial setup task).
**Why:** Keeping routing as a data model makes cycle detection and topological sort cheap and testable without audio context.

## Rule: startQualityManager() must be called once in Index.tsx useEffect
Called in `src/pages/Index.tsx` alongside `bindInternalSource()`, `initSchedulerBindings()`, `bindParamUpdates()`. It starts FPS measurement and the 500ms quality evaluation loop. Safe to call multiple times (idempotent guard inside).
**Why:** Without it, `currentQuality` in the store never updates and `qualityProfile: "AUTO"` has no effect.

## Initialization order in Index.tsx useEffect
Must be: bindInternalSource → initSchedulerBindings → bindParamUpdates → startQualityManager.
**Why:** The internal source must be registered before the scheduler starts consuming MasterClock events.

## LFO sample-hold: ConstantSourceNode, not OscillatorNode
`createLFO()` in `src/lib/dsp/lfo.ts` uses `ConstantSourceNode` with `setValueAtTime` for S&H (not "square" OscillatorNode). The `LFONode.osc` field is now typed as `AudioScheduledSourceNode`. `LFONode` has an optional `dispose()` for the S&H scheduling timer.
**Why:** OscillatorNode produces continuous bandlimited waveforms; S&H requires discrete random steps.

## ModRoute.cc field for MIDI CC source
`src/lib/model.ts` — `ModRoute` has `cc?: number` (0–127). `src/lib/audio/modulation.ts` passes `route.cc` to `srcValue()`. Defaults to CC 0 if absent.
**Why:** Previously hardcoded to CC 0; all MIDI CC routes were fighting over the same controller.

## downloadSourceZip return type
`src/lib/downloadSource.ts` returns `DownloadSourceResult { initiated, files, bytes }`. GithubSyncDialog uses `r.files` and `r.bytes`.
**Why:** Original stub returned `boolean`; dialog expected object shape; caused TS errors.

## Pre-existing TS errors (not regressions)
`src/components/ui/*.jsx` and several groovebox dialogs have pre-existing TypeScript errors that predate this project. They do not block the Vite build (Vite does not type-check). Do not treat them as regressions.
