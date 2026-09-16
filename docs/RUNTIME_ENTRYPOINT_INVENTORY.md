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

## 2. Shared InstrumentKeyboard — migrated

File: `src/components/groovebox/InstrumentKeyboard.tsx`

Old direct path:

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

The component now tracks pointer→note ownership. Pointer up, pointer cancel and lost pointer capture issue a Runtime release command. Component unmount issues an all-notes-off recovery command for the active instrument route.

Classification: `A`  
Status: `STATICALLY VERIFIED — UI BYPASS REMOVED`

### Browser release caveat

The existing browser `triggerPart()` API schedules a finite `gateSec` but does not expose a reusable per-note release handle. Therefore the Runtime reports browser release as `gate`, not `explicit`.

### Native authority rule

Native mode never falls through from PerformanceInput to audible WebAudio.

---

## 3. 3D Bass live keyboard

`Bass3DPage` declares `instrument="bass3d"`.

Native path:

```text
InstrumentKeyboard
→ performanceNoteOn
→ activateNativeAudio
→ window.VibeCoreNative.bassNoteOn
→ NativeAudioBridge.kt
→ JNI jni_bass_bridge.cpp
→ BassEngine
→ BassNode command queue
→ audio graph
```

Release:

```text
pointer up/cancel/lost capture
→ performanceNoteOff
→ bassNoteOff
```

Recovery:

```text
unmount
→ performanceAllNotesOff
→ bassAllNotesOff
```

Status: `STATICALLY VERIFIED`  
Runtime/audio result: `NOT EXECUTED`

---

## 4. 3D Synth live keyboard

Browser source path exists through `triggerPart → trigger3DSynth`.

No dedicated Native 3D Synth engine/node/JNI live-note route is source-proven. The Native C++ top-level currently exposes dedicated `bass`, `groove` and `voice` modules; `TrackMode::Synth` alone is routing metadata and is not proof of a synth renderer.

The keyboard can infer the route from canonical Part state:

- engine `3D` → `synth3d`
- engine `3D Bass` → `bass3d`
- otherwise → `part`

On Native, `synth3d` returns unsupported. It does **not** silently start WebAudio.

Status: Browser `STATICALLY VERIFIED`; Native `UNSUPPORTED / IMPLEMENTATION GAP`.

---

## 5. Current-scene Native Groove project mirror

A first frontend ProjectMirror exists for the current Pattern/Scene and up to 16 native tracks. It maps pattern length, swing, track mute/solo/volume/mode, steps, probability, accent, ratchet/roll, microtiming and piano-roll notes.

Important semantic conversions are explicit:

- Web swing `50 = straight` → Native swing `0 = straight`
- Web ratchet = total hits → Native roll count = additional hits
- Web micro percentage domain → Native PPQ tick domain

The Native `GrooveEngine` now has a project-load guard so bulk hydration can avoid polluting undo history.

Open gate: Kotlin/JNI begin/end project-load marshalling is not yet committed because the large Kotlin bridge cannot safely be replaced from truncated connector output. The mirror therefore is **not yet bound as automatic runtime hydration**.

Status: mirror/conversions `STATICALLY VERIFIED`; complete Store→Native runtime transfer `NOT EXECUTED / INCOMPLETE`.

---

## 6. Sample Forge decode/edit

Predominantly:

```text
file/buffer
→ decode
→ AudioBuffer transforms
→ normalize/reverse/trim/fade/pitch/stretch/freeze
→ assign buffer
```

Classification: `B`.

These operations do not need to be moved through Oboe merely to satisfy audible runtime authority.

---

## 7. Sample Forge / Forge audition

Preview and region audition still create audible WebAudio output.

Classification: `A`  
Status on Native: `P0/P1 AUTHORITY GAP`

Target:

```text
UI
→ RuntimePreview.playBuffer / playRegion
→ selected renderer
```

Offline render/decode stays in `AudioAssetService`.

---

## 8. Remix file analysis

File analysis uses browser decode/PCM analysis.

Classification: `B`.

No competing audible renderer is proven by decode alone. Realtime input/remix ownership remains separate work.

---

## 9. Voice

Native Voice bridge is source-proven through Kotlin → JNI → `VoiceEngine` → `VoiceNode`, including note lifecycle, sample management, live-input enablement and DSP parameters.

The complete frontend Voice UI → Runtime → Native caller mapping is still incomplete.

Classification: native backend `STATICALLY VERIFIED`; frontend ownership `E / PARTIAL`.

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

Implemented frontend pieces now include:

```text
VibeCoreRuntime boundary
├ Transport              ← TopBar + Performance migrated
├ PerformanceInput       ← shared InstrumentKeyboard migrated
├ ProjectMirror          ← current-scene v1 exists, auto-hydration gate open
├ Timing units           ← branded Beat/Clock24/Sixteenth/PPQ conversion
├ Preview                ← not yet migrated
├ Parameters             ← not yet centralized
└ Diagnostics            ← partial
```

Separate service boundary remains required:

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

1. Finish Kotlin/JNI `beginProjectLoad/endProjectLoad` marshalling safely and bind Current-Scene ProjectMirror after native activation.
2. Provide a real browser performance voice handle so `noteOff/allNotesOff` can be explicit rather than gate-only.
3. Decide/implement Native 3D Synth renderer rather than using WebAudio fallback.
4. Migrate Sample Forge / Forge audible preview to RuntimePreview.
5. Migrate/capability-gate bRAINWAVEz, Spatial and granular audible paths.
6. Complete Voice frontend caller mapping.
7. Execute typecheck/unit/native/APK/device verification.

## Performance truth

No measurements are claimed:

- CPU `UNKNOWN`
- RAM `UNKNOWN`
- XRuns `UNKNOWN`
- Jitter `UNKNOWN`
- Latency `UNKNOWN`
- Callback duration `UNKNOWN`
