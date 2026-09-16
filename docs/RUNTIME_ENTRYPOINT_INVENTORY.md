# VibeCoreLiv3 — Runtime Entry-Point Inventory

Stand: 2026-09-16
Basis-HEAD: `308ae3849ca5bbce9142252f660e4bc2bc870672`
Status: `STATIC AUDIT / IN PROGRESS`

## Purpose

This inventory classifies every inspected frontend action that can initialize, schedule, modify or render audio.

The goal is not to ban WebAudio. The goal is to prove which operations are allowed to remain browser-side and which audible operations must pass through the selected authoritative Runtime.

## Categories

### A — AUDIBLE_RUNTIME_COMMAND
Can create or change audible real-time output.

On Native Android this must ultimately route through the selected Native runtime unless an explicit capability contract says otherwise.

### B — AUDIO_DECODE_ANALYSIS
File decoding, PCM conversion, offline analysis/edit preparation.

May remain browser-side if it does not become an audible competing output graph.

### C — CONTROL_RATE
Parameter/modulation updates. FREE control may be local; synchronized control must derive musical phase from authority.

### D — UI_DIAGNOSTIC
Visuals, gesture timers, diagnostics, debouncing. No musical authority.

### E — UNKNOWN
Caller/ownership incomplete. Gate B0 remains open.

---

## 1. Global transport — TopBar

File: `src/components/groovebox/TopBar.tsx`

Observed play path:

```text
handlePlay()
├ Native detected
│  → activateNativeAudio()
│  → togglePlay()
│  → nativeAudioRuntime subscriber
│  → Native backend play
└ Browser
   → ensureAudio()
   → resume AudioContext if needed
   → togglePlay()
   → browser scheduler
```

Classification: `A — AUDIBLE_RUNTIME_COMMAND`

Status: `STATICALLY VERIFIED / BACKEND-AWARE ENTRY`

This is currently the clearest frontend example of the intended runtime-selection pattern.

### Master volume caveat

The same TopBar master control performs both:

```text
store.setMasterVolume(v)
engine.setMasterVolume(v)
```

The Store change is mirrored into the Native backend by `nativeAudioRuntime` when Native is active, while the direct engine setter targets WebAudio.

The direct setter may be a no-op when no browser graph exists, but this must be tested; it is not yet safe to call the master path fully authority-clean.

---

## 2. Performance transport — inconsistent with TopBar

File: `src/components/groovebox/PerformanceTab.tsx`

Observed play path:

```text
handlePlay()
→ ensureAudio()
→ getCtx()
→ resume browser AudioContext
→ togglePlay()
```

Unlike TopBar, this code does not check `isNativeAudioPath()` and does not call `activateNativeAudio()` directly.

The Store transport change will still be observed by `nativeAudioRuntime`, so Native may subsequently start too.

### Static consequence

On Native Android the action can initialize/resume WebAudio before starting Native transport.

This does not prove two audible transports because the browser scheduler has a Native exclusion guard, but it does prove an inconsistent runtime entry policy.

Classification: `A — AUDIBLE_RUNTIME_COMMAND`

Status: `P0/P1 ARCHITECTURE INCONSISTENCY`

Required future rule:

```text
all transport UI
→ RuntimeTransport.play/stop/seek
→ selected backend
```

No UI surface may decide startup semantics independently.

---

## 3. 3D Synth live keyboard

Files:

- `src/components/groovebox/Synth3DPage.tsx`
- `src/components/groovebox/InstrumentKeyboard.tsx`

Observed path:

```text
Synth3DPage
→ InstrumentKeyboard
→ pointerDown
→ ensureAudio()
→ getCtx()
→ triggerPart(partId, ctx.currentTime, ...)
→ WebAudio 3D Synth path
```

No `AudioBackend`/`nativeAudioRuntime` decision occurs.

Classification: `A — AUDIBLE_RUNTIME_COMMAND`

Status: `P0 AUTHORITY CONFLICT ON NATIVE`

---

## 4. 3D Bass live keyboard

Files:

- `src/components/groovebox/Bass3DPage.tsx`
- `src/components/groovebox/InstrumentKeyboard.tsx`

Same shared keyboard path as Synth3D.

Classification: `A — AUDIBLE_RUNTIME_COMMAND`

Status: `P0 AUTHORITY CONFLICT ON NATIVE`

Additional contract gap: the shared keyboard currently treats pointer-up/cancel mainly as UI state release; the audited component does not expose an explicit backend-neutral `noteOff` call. The future Input Runtime must define note-on/note-off lifecycle centrally.

---

## 5. Sample Forge file decode/edit

File: `src/components/groovebox/SmplTab.tsx`

Observed operations include:

```text
ensureAudio()
decodeSampleFile
AudioBuffer transforms
normalize/reverse/trim/fade/pitch/stretch/freeze
assignBufferToPart
```

Classification: predominantly `B — AUDIO_DECODE_ANALYSIS/EDIT`.

These operations do not need to be pushed through Oboe merely to satisfy runtime authority. They need a clean service boundary so browser decode/edit cannot accidentally imply browser audible ownership.

---

## 6. Sample Forge audition

Observed paths:

```text
preview
→ ensureAudio()
→ previewBuffer(...)
→ WebAudio output

slice audition
→ ensureAudio()
→ triggerSampleRegion(...)
→ WebAudio output
```

Classification: `A — AUDIBLE_RUNTIME_COMMAND`

Status: `P0/P1 AUTHORITY CONFLICT ON NATIVE`

Future path:

```text
Sample Forge UI
→ RuntimePreview.playBuffer / playRegion
→ Web adapter OR Native adapter
```

---

## 7. Forge rendering vs audition

File: `src/components/groovebox/ForgeTab.tsx`

Observed render-to-buffer path:

```text
ensureAudio()
→ renderPresetToAudioBuffer(ctx, draft)
→ AudioBuffer
```

Sending the rendered buffer to a Part:

```text
renderPresetToAudioBuffer
→ assignBufferToPart
→ store sample name
```

Classification: `B — AUDIO_DECODE_ANALYSIS/EDIT` / offline synthesis-to-buffer.

Observed audition path:

```text
renderPresetToAudioBuffer
→ previewBuffer
→ WebAudio output
```

Classification: `A — AUDIBLE_RUNTIME_COMMAND`.

Status on Native: audition requires runtime routing; render-to-buffer may remain browser/offline if deterministic and performant enough.

---

## 8. Remix file analysis

File: `src/components/groovebox/RemixTab.tsx`

Observed path:

```text
file.arrayBuffer()
→ ensureAudio()
→ decodeAudioData()
→ bufferToPCM()
→ analyzeRemixAudioInput()
```

Classification: `B — AUDIO_DECODE_ANALYSIS`.

No competing audible renderer is proven by this path alone.

`Date.now()` is used as an AI/generative seed, not playback timing.

Long-press `setTimeout` is UI gesture timing.

---

## 9. Voice UI

File: `src/components/groovebox/VoiceTab.tsx`

The inspected UI primarily performs:

- Store recording toggle,
- note/take editing,
- AI transformations,
- store parameter writes.

The file does not itself prove calls into Native `voiceSet*`, `voiceLoadSample` or `voiceSetLiveInputEnabled`.

Classification: `E — UNKNOWN` for actual live Voice runtime ownership.

Required caller proof remains:

```text
Voice UI / input
→ TS runtime/bridge
→ Kotlin Voice bridge
→ JNI Voice
→ native VoiceEngine
```

---

## 10. bRAINWAVEz

File: `src/lib/audio/brainwave.ts`

Observed:

```text
ensureAudio()
→ build WebAudio oscillator graph
→ masterInput()
→ audible WebAudio output
```

Timing modes:

- FREE — intentionally independent rates,
- SYNC — rates derived from MasterClock division,
- HYBRID — selected phase behavior derived from MasterClock.

Timing contract is comparatively clear, but render authority remains browser-side.

Classification:

- timing: `C — CONTROL_RATE`, mostly explicit,
- output: `A — AUDIBLE_RUNTIME_COMMAND/ENGINE`.

Status on Native: `P1 — RENDER AUTHORITY NOT RESOLVED`.

---

## 11. Modulation

File: `src/lib/audio/modulation.ts`

Observed:

```text
requestAnimationFrame loop
→ AudioContext.currentTime
→ calculate LFO/ENV/mod offsets
→ write WebAudio AudioParams / trigger offsets
```

Classification: `C — CONTROL_RATE`.

FREE behavior is plausible; synchronized phase is not yet proven authoritative.

Native adoption/translation is also not proven.

---

## 12. Granular/freeze

File: `src/lib/audio/granular.ts`

Observed direct WebAudio/AudioWorklet scheduling and freeze-loop rendering.

Classification:

- scheduling: `C/A — AUDIO TEXTURE CONTROL + AUDIBLE RENDER`,
- Native ownership: unresolved.

Status: `P1 RENDER AUTHORITY NOT RESOLVED`.

---

## 13. Startup bindings

File: `src/pages/Index.tsx`

Installed once:

```text
bindNativeAudioRuntime()
bindInternalSource()
initSchedulerBindings()
bindParamUpdates()
startQualityManager()
```

The transport scheduler contains Native exclusion.

`bindParamUpdates()` remains a browser-engine binding installed on all platforms.

Classification: `C/E — CONTROL BINDING / NATIVE BEHAVIOR REQUIRES TEST`.

---

## 14. Current architecture truth

The current frontend does NOT have one universal audio command entry point.

Instead it has a mixture of:

```text
backend-aware UI
  TopBar transport

store-only actions later observed by runtime
  many transport/state operations

direct browser audio commands
  InstrumentKeyboard
  Sample Forge preview/slices
  Forge audition
  bRAINWAVEz
  granular
  modulation WebAudio params

decode/analysis operations
  Remix file analysis
  Sample/Forge buffer processing

native-specialized bridge surface
  Groove/Bass/Voice methods in Kotlin/JNI
```

Therefore the future Runtime Contract must be narrower and more precise than "put everything behind AudioBackend".

## 15. Proposed contract split after Gate B0

No implementation yet. Candidate architecture for ADR decision:

```text
VibeCoreRuntime
├ Transport
│  ├ play / stop / seek / tempo
├ PerformanceInput
│  ├ noteOn / noteOff / allNotesOff
│  ├ triggerSample / triggerRegion
├ ProjectMirror
│  ├ pattern / scene / step / notes / routing
├ Parameters
│  └ authoritative parameter writes
├ Preview
│  └ audition buffer/region through selected renderer
└ Diagnostics
   └ backend/runtime state

AudioAssetService
├ decode file
├ transform/render offline buffer
├ waveform/analysis cache
└ PCM conversion
```

This preserves useful browser-side decoding/editing while enforcing one audible runtime authority.

## 16. Gate B0 remaining work

Before ADR-0002 can be decided:

1. prove or disprove Store → Native Groove project mirror,
2. inventory TS callers of Kotlin Groove/Bass/Voice methods,
3. inspect Voice live input caller path,
4. inspect direct audio entry points in remaining Performance/Prod/FX/Spatial modules,
5. finish timer/native-clock classification,
6. define contract/null/timing tests against the completed inventory,
7. execute no migration until this is complete.

## Performance truth

Still no measurements:

- CPU `UNKNOWN`
- RAM `UNKNOWN`
- XRuns `UNKNOWN`
- Jitter `UNKNOWN`
- Latency `UNKNOWN`
- Callback duration `UNKNOWN`
