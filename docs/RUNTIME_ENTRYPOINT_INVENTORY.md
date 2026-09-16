# VibeCoreLiv3 — Runtime Entry-Point Inventory

Stand: 2026-09-16  
Status: `STATIC AUDIT + INCREMENTAL MIGRATION / RUNTIME NOT EXECUTED`

## Purpose

This inventory classifies frontend actions that can initialize, schedule, modify or render audio. The rule is not “ban WebAudio”; it is “one authoritative **audible** runtime per platform”. Browser-side decode, offline transform, analysis and caching may remain browser-side when they do not create a competing audible graph.

## Categories

- `A — AUDIBLE_RUNTIME_COMMAND`: can create/change audible realtime output.
- `B — AUDIO_DECODE_ANALYSIS`: decode, PCM conversion, offline analysis/edit preparation.
- `C — CONTROL_RATE`: parameter/modulation updates. Synced control must derive phase from authority.
- `D — UI_DIAGNOSTIC`: visuals, gesture timers, diagnostics, debouncing.
- `E — UNKNOWN`: ownership/caller proof incomplete.

---

## 1. Global transport — TopBar + Performance

Both migrated surfaces now route through:

```text
UI
→ toggleRuntimePlay()
→ selectedRuntimeKind()
   ├ oboe-native → activateNativeAudio()
   └ webaudio    → ensureAudio()
→ store transport transition
→ selected runtime subscriber
```

Classification: `A`  
Status: `STATICALLY VERIFIED — FRONTEND ENTRY CONSOLIDATED`

Runtime execution remains `NOT EXECUTED`.

---

## 2. Shared InstrumentKeyboard — migrated and lifecycle-hardened

File: `src/components/groovebox/InstrumentKeyboard.tsx`

The old direct path:

```text
InstrumentKeyboard
→ ensureAudio()
→ getCtx()
→ triggerPart()
```

has been removed from the component.

Current path:

```text
InstrumentKeyboard
→ performanceNoteOn / performanceNoteOff / performanceAllNotesOff
→ selected runtime
```

The component reserves pointer ownership before awaiting runtime activation. Pointer up/cancel/lost-capture while startup is pending is retained and converted into a matching release if the delayed note-on later succeeds. Unmount also issues instrument-scoped recovery without updating disposed React state.

Classification: `A`  
Status: `STATICALLY VERIFIED — UI BYPASS REMOVED / ASYNC UI RACE GUARDED`

### Browser 3D registration acknowledgement — CLOSED STATICALLY

`triggerPart()` intentionally keeps its scheduler-friendly void API and starts the 3D dynamic-import branch asynchronously. Rather than creating another trigger path, `PerformanceInput` now arms a one-shot waiter in the existing 3D voice engine before calling `triggerPart()`.

```text
PerformanceInput
→ arm waitForNoteStart3D / waitForNoteStart3DBass
→ triggerPart
→ dynamic import
→ existing voice engine inserts ActiveNote
→ notifyNoteStarted
→ PerformanceInput accepts noteOn
```

A bounded timeout produces a failed Runtime note-on instead of falsely claiming registration.

### Browser 3D release

3D Synth and 3D Bass reuse their existing per-part voice engines. The low-level voice `noteOff()` methods do not shorten the already-scheduled amp ADSR, so live release reuses the existing `steal(releaseSec)` primitive, which cancels scheduled amp automation and fades from the current value.

No second allocator or voice manager was introduced.

Browser generic Parts remain gate-based.

---

## 3. 3D Bass live keyboard

`Bass3DPage` declares `instrument="bass3d"`.

Native path:

```text
InstrumentKeyboard
→ PerformanceInput
→ activateNativeAudio
→ window.VibeCoreNative.bassNoteOn
→ NativeAudioBridge.kt
→ JNI jni_bass_bridge.cpp
→ BassEngine
→ BassNode command queue
→ audio graph
```

Native release/recovery:

```text
pointer release → bassNoteOff
unmount/panic   → bassAllNotesOff
```

Browser uses the existing Bass3D voice engine plus registration acknowledgement and explicit fade-release.

A pre-existing allocator leak in Bass legato/glide was also found statically: a new global allocation handle was requested even though the active voice was reused, then the function returned without releasing that new handle. The unused handle is now released before return.

Status: routes/fix `STATICALLY VERIFIED`; audio behavior `NOT EXECUTED`.

---

## 4. 3D Synth live keyboard

Browser path now has registration acknowledgement and explicit release through the existing Synth3D voice engine.

No dedicated Native 3D Synth engine/node/JNI live-note route is source-proven. `TrackMode::Synth` is routing metadata, not renderer evidence.

The keyboard infers routes from canonical Part state:

- engine `3D` → `synth3d`
- engine `3D Bass` → `bass3d`
- otherwise → `part`

On Native, `synth3d` returns unsupported and does **not** silently start WebAudio.

Status: Browser `STATICALLY VERIFIED`; Native `UNSUPPORTED / IMPLEMENTATION GAP`; runtime `NOT EXECUTED`.

---

## 5. Current-scene Native Groove project mirror

A frontend ProjectMirror exists for the current Pattern/Scene and up to 16 native tracks. It maps pattern length, swing, track mute/solo/volume/mode, steps, probability, accent, ratchet/roll, microtiming and piano-roll notes.

Semantic conversions are explicit:

- Web swing `50 = straight` → Native swing `0 = straight`
- Web ratchet = total hits → Native roll count = additional hits
- Web micro percentage domain → Native PPQ tick domain

The Native `GrooveEngine` has a project-load guard so bulk hydration can avoid polluting undo history.

Open gate: Kotlin/JNI begin/end project-load marshalling is not yet committed because the large Kotlin bridge cannot safely be replaced from truncated connector output. The mirror is therefore **not yet bound as automatic runtime hydration**.

Status: mirror/conversions `STATICALLY VERIFIED`; complete Store→Native runtime transfer `INCOMPLETE / NOT EXECUTED`.

---

## 6. RuntimePreview boundary — implemented, callers only partially migrated

`src/lib/runtime/preview.ts` now separates audible audition from decode/offline work.

```text
RuntimePreview
├ capability()       ← no renderer initialization
├ previewBuffer()
└ previewPartRegion()
```

Browser reuses existing `previewBuffer` and `triggerSampleRegion`.

Native currently returns `unsupported`; it does **not** fall through to WebAudio. Native Voice has 8 real user sample slots and no reserved audition slot contract, so RuntimePreview intentionally does not commandeer an arbitrary slot.

Classification: boundary `STATICALLY VERIFIED`; Native Preview `IMPLEMENTATION GAP`; Forge/SampleForge caller migration `PARTIAL`.

---

## 7. Sample Forge / Forge

Decode, deterministic render and transforms are primarily `B — AUDIO_DECODE_ANALYSIS/EDIT` and may remain browser/offline services.

Audition is `A — AUDIBLE_RUNTIME_COMMAND` and must use RuntimePreview. Existing callers are being migrated; direct Native→WebAudio audition is forbidden.

---

## 8. Remix file analysis

File analysis uses browser decode/PCM analysis.

Classification: `B`.

No competing audible renderer is proven by decode alone. Realtime input/remix ownership remains separate work.

---

## 9. Voice

Native Voice is source-proven through Kotlin → JNI → `VoiceEngine` → `VoiceNode`, including modes, pitch/formant, harmonizer/doubler, dynamics/EQ, breath/texture, envelopes/LFOs, mod matrix, stereo, note lifecycle, sample management and live-input control.

The current `VoiceTab` is still primarily a generic Part/store editor. A dedicated frontend RuntimeVoice/Parameter contract is not yet proven.

Classification: Native backend `STATICALLY VERIFIED`; frontend ownership `PARTIAL / ACTIVE AUDIT`.

---

## 10. bRAINWAVEz

Current implementation builds an audible WebAudio graph. SYNC/HYBRID rates derive from MasterClock, so timing intent is clearer than render ownership.

Classification: timing `C`; renderer `A`.  
Native status: `P1 — RENDER AUTHORITY GAP`.

---

## 11. Modulation / Granular

`modulation.ts` uses a control-rate `requestAnimationFrame` loop and WebAudio time. FREE control is plausible; synchronized phase contract and Native translation remain incomplete.

Granular/freeze uses direct browser audio scheduling/processing.

Classification: `C/A`.  
Native status: unresolved.

---

## 12. Startup bindings

Startup installs Native runtime binding and Browser scheduler binding. The browser scheduler contains a Native exclusion guard, so it does not intentionally start on Native.

This proves scheduler exclusion logic statically; it does **not** prove that no other browser audible graph starts on Native.

---

## 13. Current runtime boundary

```text
VibeCoreRuntime boundary
├ Transport              ← TopBar + Performance migrated
├ PerformanceInput       ← InstrumentKeyboard migrated/hardened
│  ├ Native Bass explicit lifecycle
│  ├ Browser 3D registration acknowledgement + release
│  └ Native Synth intentionally unsupported
├ ProjectMirror          ← current-scene v1; auto-hydration gate open
├ Timing units           ← branded Beat/Clock24/Sixteenth/PPQ
├ Preview                ← boundary exists; caller migration partial
├ Voice                  ← contract audit active
├ Parameters             ← not yet centralized
└ Diagnostics            ← partial
```

Separate service boundary:

```text
AudioAssetService
├ decode
├ offline transform/render
├ analysis
├ waveform/cache
└ PCM conversion
```

---

## 14. Next authority work

1. Complete Voice UI → RuntimeVoice/Parameter contract mapping.
2. Finish safe Forge/SampleForge caller migration to RuntimePreview.
3. Finish Kotlin/JNI `beginProjectLoad/endProjectLoad` marshalling and bind Current-Scene ProjectMirror.
4. Define a dedicated Native Preview contract without stealing Voice user slots.
5. Decide/implement Native 3D Synth renderer rather than using WebAudio fallback.
6. Capability-gate bRAINWAVEz, Spatial and granular audible paths.
7. Execute typecheck/unit/native/APK/device verification when an executable worktree is available.

## Performance truth

No measurements are claimed:

- CPU `UNKNOWN`
- RAM `UNKNOWN`
- XRuns `UNKNOWN`
- Jitter `UNKNOWN`
- Latency `UNKNOWN`
- Callback duration `UNKNOWN`
