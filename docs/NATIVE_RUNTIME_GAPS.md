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

`Synth3DPage.tsx` and `Bass3DPage.tsx` both embed this same `InstrumentKeyboard`, so this direct WebAudio path is the current live-performance entry point for both 3D instruments.

Therefore source currently proves:

```text
3D Synth / 3D Bass UI
→ InstrumentKeyboard
→ WebAudio engine
```

but does NOT prove:

```text
3D Synth / 3D Bass UI
→ selected authoritative Runtime
```

### Risk

Even when the sequencer WebAudio scheduler is disabled on Native Android, live keyboard interaction may still activate an audible WebAudio path in the WebView while the Native Oboe engine also exists.

This means:

`browser scheduler excluded` != `one audio renderer proven`.

### Status

`ARCHITECTURE CONFLICT / STATICALLY VERIFIED CALL EDGE`

No refactor is performed in this audit phase. The future runtime contract must route live note actions through one backend-aware command path with explicit note-on and note-off semantics.

## P0 — Sample Forge has direct audible WebAudio preview/trigger paths

`SmplTab.tsx` imports browser-engine functions directly:

```text
ensureAudio
getBuffer
assignBufferToPart
previewBuffer
decodeSampleFile
triggerPart
triggerSampleRegion
normalizeBuffer
reverseBuffer
```

Confirmed audible paths include:

```text
Sample Forge preview
→ ensureAudio()
→ previewBuffer(...)
→ WebAudio output

Sample slice pad
→ ensureAudio()
→ triggerSampleRegion(...)
→ WebAudio output
```

Editing/decoding operations also use WebAudio `AudioBuffer`, but analysis/editing context use must be distinguished from audible rendering.

### Status

- sample decode/edit using browser `AudioBuffer`: `ANALYSIS/EDIT CONTEXT — MAY BE VALID ON NATIVE`
- preview and slice trigger through browser graph on Native: `RUNTIME AUTHORITY CONFLICT / STATICALLY VERIFIED CALL EDGE`

Future runtime consolidation must not unnecessarily forbid browser-side offline decode/edit operations. It must gate only audible render/trigger operations through the selected Runtime.

## P1 — WebAudio side engines may remain independently audible on Native

The following inspected subsystems call `ensureAudio()` / use the browser AudioContext directly:

- generic engine / `triggerPart`
- InstrumentKeyboard
- 3D Synth live keyboard via `InstrumentKeyboard`
- 3D Bass live keyboard via `InstrumentKeyboard`
- Sample Forge preview / slice trigger
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

## P1 — Analysis-only AudioContext use must not be confused with render authority

`RemixTab.tsx` calls `ensureAudio()` to obtain an `AudioContext`, decodes a selected audio file with `decodeAudioData`, converts it to PCM and passes it to remix analysis.

Observed path:

```text
file input
→ ensureAudio()
→ decodeAudioData
→ PCM conversion
→ BPM/key/energy/clipping analysis
```

This is not, by itself, an audible competing renderer.

### Architectural requirement

The future Runtime/API split should distinguish:

- `AudioDecode/AnalysisService` — may use browser decoding where appropriate,
- `AudioRuntime` — owns audible transport/voices/DSP/output,
- `Native Runtime` — authoritative audible renderer on Android when selected.

This avoids forcing offline/file analysis through Oboe merely to satisfy a superficial "one backend" rule.

## P1 — Voice UI currently does not prove native live-input/runtime control

`VoiceTab.tsx` is currently state-oriented: record toggle, note/take editing, AI transformations and store parameter writes are visible in the inspected UI file.

It does not itself prove calls to the large native Voice bridge surface (`voiceSet*`, `voiceLoadSample`, `voiceSetLiveInputEnabled`, etc.).

This does not prove absence because another bridge layer may exist, but it keeps native Voice parameter/state mirroring in the caller-inventory gate.

Status: `UNKNOWN / CALLER INVENTORY REQUIRED`.

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

The runtime boundary should apply to audible commands, not blindly to decode/analysis utilities.

## P1 — Startup installs both native and WebAudio-side control bindings

`Index.tsx` installs on mount:

```text
bindNativeAudioRuntime()
bindInternalSource()
initSchedulerBindings()
bindParamUpdates()
startQualityManager()
```

`initSchedulerBindings()` has a proven Native exclusion guard for browser transport scheduling. However `bindParamUpdates()` is installed regardless of platform and belongs to the direct WebAudio engine layer.

Installing the binding is not proof of concurrent audible rendering, but its platform behavior must be included in the Runtime Authority tests.

Required test:

```text
Native active
→ WebAudio parameter binding cannot create/drive an audible browser graph unintentionally
```

## P1 — Timing-domain ambiguity

Three timing units are already proven:

- MasterClock: 24 ticks / beat
- browser scheduler: sixteenth counters
- Native VibeCoreSync: 1920 PPQ / 480 ticks per sixteenth

These require explicit typed conversions before consolidation.

## P1 — Modulation sync authority incomplete

`modulation.ts` computes control-rate LFO/ENV phase from `AudioContext.currentTime` and BPM inside a `requestAnimationFrame` loop.

Free-running modulation is valid; synchronized modulation requires an explicit MasterClock/Native-Sync-derived phase contract.

## P2 — `Date.now()` appears in deterministic-content seed selection, not musical scheduling

Inspected UI code uses `Date.now()` for AI/generative seeds in Bass/Remix workflows. This affects generated content variation but does not schedule playback events.

Classification: `NON-MUSICAL RANDOM-SEED INPUT`.

Reproducible export/session behavior may later prefer persisted explicit seeds, but this is not a clock-authority violation.

## Runtime-entry classification rule

Every direct audio entry must now be assigned one category before implementation:

1. `AUDIBLE_RUNTIME_COMMAND` — must route through selected authoritative Runtime.
2. `AUDIO_DECODE_ANALYSIS` — may use browser/offline/native decode service without owning output.
3. `CONTROL_RATE` — must be FREE or derive sync phase from the authoritative clock.
4. `UI_DIAGNOSTIC` — no musical authority.
5. `UNKNOWN` — blocks Gate B0 until resolved.

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
2. complete direct audible-runtime entry inventory (`ensureAudio`, `triggerPart`, previews, live inputs)
3. complete timer/render-path audit
4. define authority decision in ADR-0002
5. define contract tests
6. only then implement state mirror/runtime adapter changes
7. execute Android evidence gate
