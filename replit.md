# SonicArchitect (VibeCoreLiv3)

A professional browser-based Digital Audio Workstation (DAW) / groovebox.
All audio is fully procedural — no static audio files. The engine runs entirely
in the browser via the Web Audio API.

## Stack

| Layer | Technology |
|---|---|
| UI | React 18 + React Router 6 + shadcn/ui + Tailwind 3 |
| State | Zustand 5 (persist v12 → localStorage `vibecore-liv3-project`) |
| Audio engine | Web Audio API — `src/lib/audio/engine.ts` (singleton) |
| Scheduler | Look-ahead AudioContext-time — `src/lib/audio/scheduler.ts` |
| Clock | Pull-based master clock — `src/lib/clock/masterClock.ts` |
| DSP | Pure primitives — `src/lib/dsp/` |
| 3D voices | `src/lib/synth3d/` + `src/lib/bass3d/` |
| Forge graph | Block-based offline DSP — `src/lib/forge/` |
| FX routing | `src/lib/fxmixlab/` |
| AI assistant | Deterministic (no LLM) — `src/lib/audio/aiSceneBuild.ts` |
| Backend | Base44 hosted (no server-side entities; all data is client-side) |

## Running on Replit

```bash
npm install
npm run dev   # Vite dev server → port 5173
```

The configured Replit workflow runs `npm run dev`. After it starts the preview
pane shows the app.

### Optional: Base44 hosted backend

The app runs fully offline (all project data in localStorage). To connect a
Base44 app, create `.env.local` (never commit this file):

```
VITE_BASE44_APP_ID=<your-app-id>
VITE_BASE44_APP_BASE_URL=https://your-app.base44.app
```

## Build & Checks

```bash
npm run build       # production build → ./dist
npm run lint        # ESLint
npm run typecheck   # tsc via jsconfig (covers all of src/)
```

## Key Modules

| Path | Purpose |
|---|---|
| `src/lib/store.ts` | Zustand store — all project state, actions, persistence |
| `src/lib/model.ts` | Domain types: Part, Scene, Pattern, Step, Note, FxSlot, ModRoute |
| `src/pages/Index.tsx` | Composition root — mounts all tab UIs, wires scheduler + clock |
| `src/lib/audio/engine.ts` | WebAudio graph, master/FX/part strips, voice dispatch |
| `src/lib/audio/scheduler.ts` | Look-ahead step/scene/chain scheduler |
| `src/lib/clock/masterClock.ts` | Single timing authority (BPM, transport, subscribers) |
| `src/lib/dsp/` | Pure DSP primitives (filters, envelopes, LFOs, reverb, …) |
| `src/components/groovebox/` | All 14+ workflow tab UIs |
| `src/workers/granular-processor.worklet.ts` | AudioWorklet — real-time grain scheduling |
| `src/workers/prodRender.worker.ts` | Web Worker — offline production render |

## Workers

| Path | Role |
|---|---|
| `src/workers/granular-processor.worklet.ts` | AudioWorklet — real-time grain scheduling |
| `src/workers/prodRender.worker.ts` | Web Worker — offline production render |

## Native Android (separate build)

`native-android/` — Oboe real-time mixer + JNI bridge → exposes
`window.VibeCoreNative` to the WebView. Not part of the Vite build.

## Startup sequence (App → Audio ready)

```
App Start
    ↓
VibeCore Sync (masterClock / bindInternalSource)
    ↓
Audio Engine (initSchedulerBindings / bindParamUpdates)
    ↓
MIDI Sync start (startMidiSync → masterClock source swap on lock)
    ↓
Clock listeners registered
    ↓
Groove / Synth / FX respond to Transport & Clock
```

## User Preferences

- Preserve all existing module boundaries and naming conventions.
- Do not simplify, restructure, or migrate to other frameworks.
- Treat all audio/DSP math as authoritative — do not alter DSP algorithms
  without an explicit request.
- Self-test functions (`runDspTests`, `runSynth3DSelfTest`, etc.) must
  continue to pass after any change.
