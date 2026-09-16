# VibeCoreLiv3 — Native Runtime Gaps

Stand: 2026-09-16
Basis: current main HEAD `308ae3849ca5bbce9142252f660e4bc2bc870672`
Status: STATIC AUDIT — NO RUNTIME CLAIMS

## P0 — Store → Native Groove state mirror not proven

Current proven facts:

- Zustand owns Pattern/Scene/Step/Piano-Roll state.
- `NativeAudioBridge.kt` exposes native Groove mutation methods including step, pattern, track, scene and Piano Roll operations.
- `nativeAudioRuntime.ts` mirrors tempo, master gain, transport and seek only.
- the inspected central `store.ts` has no direct `window.VibeCoreNative` / `grooveSetStep` call.
- no dedicated TypeScript Groove-native bridge has been identified in the current `src/lib` file inventory.

Therefore the full edge

```text
UI edit
→ Zustand mutation
→ native Groove mutation
→ JNI
→ C++ GrooveEngine
→ StepSequencer
```

is not yet proven.

This remains `P0 UNKNOWN`, not a confirmed absence, until exhaustive caller inventory is complete.

## P0 — Live keyboard can still enter WebAudio directly

`InstrumentKeyboard.tsx` imports and invokes:

```text
ensureAudio()
getCtx()
triggerPart()
```

On pointer-down it creates/resumes the WebAudio runtime and directly triggers `triggerPart()` using `AudioContext.currentTime`.

This path does not consult `AudioBackend`, `NativeOboeBackend`, `nativeAudioRuntime`, or `isNativeAudioPath()`.

Therefore source currently proves:

```text
InstrumentKeyboard
→ WebAudio engine
```

but does NOT prove:

```text
InstrumentKeyboard
→ selected authoritative Runtime
```

### Risk

Even when the sequencer WebAudio scheduler is disabled on Native Android, live keyboard interaction may still activate an audible WebAudio path in the WebView while the Native Oboe engine also exists.

This means:

`browser scheduler excluded` != `one audio renderer proven`.

### Status

`ARCHITECTURE CONFLICT / STATICALLY VERIFIED CALL EDGE`

No refactor is performed in this audit phase. The future runtime contract must route live note actions through one backend-aware command path.

## P1 — WebAudio side engines may remain independently audible on Native

The following inspected subsystems call `ensureAudio()` / use the browser AudioContext directly:

- generic engine / `triggerPart`
- InstrumentKeyboard
- bRAINWAVEz
- modulation
- granular/freeze

Their existence does not automatically mean they are active concurrently with Native Oboe, but no global render-authority guard has yet been proven for all of them.

Required future proof:

```text
Native active
→ WebAudio musical rendering disabled or intentionally capability-routed
```

for every audible module.

## P1 — AudioBackend is not symmetric

`AudioBackend` currently has a concrete Native implementation only.

Browser fallback bypasses that abstraction and uses `engine.ts` directly.

This makes it impossible today to prove "all UI actions go through AudioBackend" because they do not.

Future target after Gate B0:

```text
RuntimeCommand API
  → WebAudio runtime adapter
  OR
  → Native Oboe runtime adapter
```

without UI-side backend selection.

## P1 — Timing-domain ambiguity

Three timing units are already proven:

- MasterClock: 24 ticks / beat
- browser scheduler: sixteenth counters
- Native VibeCoreSync: 1920 PPQ / 480 ticks per sixteenth

These require explicit typed conversions before consolidation.

## P1 — Modulation sync authority incomplete

`modulation.ts` computes control-rate LFO/ENV phase from `AudioContext.currentTime` and BPM inside a `requestAnimationFrame` loop.

Free-running modulation is valid; synchronized modulation requires an explicit MasterClock/Native-Sync-derived phase contract.

## Performance status

No measured performance is claimed:

- CPU — UNKNOWN
- RAM — UNKNOWN
- XRuns — UNKNOWN
- Jitter — UNKNOWN
- Latency — UNKNOWN
- Callback duration — UNKNOWN

## Required order before implementation

1. complete caller inventory for Kotlin Groove/Bass/Voice bridge methods
2. complete timer/render-path audit
3. define authority decision in ADR-0002
4. define contract tests
5. only then implement state mirror/runtime adapter changes
6. execute Android evidence gate
