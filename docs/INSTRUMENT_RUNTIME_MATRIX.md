# Instrument Runtime Matrix — v4 Runtime Consolidation

Status: STATICALLY VERIFIED MATRIX / RUNTIME NOT EXECUTED  
Date: 2026-09-16

This matrix records only source-proven live-performance routes. It must not be used as evidence that Android audio has executed successfully.

## Authority rule

When `oboe-native` is selected, a live instrument command must either:

1. reach a source-proven native renderer, or
2. return `unsupported`.

It must **not** silently start an audible WebAudio renderer.

## Matrix

| Instrument / command | Browser WebAudio | Android Native | Static evidence | Current status |
|---|---|---|---|---|
| 3D Bass noteOn | `triggerPart → trigger3DBass` | `NativeAudioBridge.bassNoteOn → JNI → BassEngine → BassNode` | source-correlated | STATICALLY VERIFIED |
| 3D Bass noteOff | browser `triggerPart` currently uses scheduled gate | `bassNoteOff → JNI → BassEngine → BassNode` | native source-correlated | Native STATICALLY VERIFIED; browser explicit release GAP |
| 3D Bass allNotesOff | no public live-performance panic boundary proven | `bassAllNotesOff → JNI → BassEngine → BassNode` | native source-correlated | Native STATICALLY VERIFIED; browser GAP |
| 3D Synth noteOn | `triggerPart → trigger3DSynth` | no dedicated native 3D Synth renderer/bridge proven | native C++ top-level contains bass/groove/voice but no synth renderer module | Browser STATICALLY VERIFIED; Native UNSUPPORTED |
| 3D Synth noteOff | scheduled WebAudio gate | no native route proven | no source-proven native synth note lifecycle | GAP / UNSUPPORTED |
| Voice noteOn/off | browser voice paths exist separately | `voiceNoteOn/voiceNoteOff/voiceAllNotesOff → JNI → VoiceEngine → VoiceNode` | source-correlated | Native STATICALLY VERIFIED; UI caller migration incomplete |
| Generic Part noteOn/off | `triggerPart` | generic `AudioBackend.noteOn` maps to **Voice**, not arbitrary Part/Bass/Synth | contract inspection | Native generic route MUST NOT be used |

## Implemented frontend boundary

`src/lib/runtime/performanceInput.ts` is now the live performance authority for migrated UI components.

```text
InstrumentKeyboard
  → performanceNoteOn / performanceNoteOff / performanceAllNotesOff
  → selected runtime
     ├─ Browser: existing triggerPart path
     └─ Native:
         ├─ Bass3D → bassNoteOn/off/allNotesOff
         ├─ Synth3D → unsupported
         └─ Generic Part → unsupported until explicitly mapped
```

The keyboard derives the runtime instrument from the canonical `Part.synth.engine` when the caller does not provide an explicit route:

- `3D Bass` → `bass3d`
- `3D` → `synth3d`
- anything else → `part`

This lets the existing Synth page remain source-compatible while still preventing a silent Native→WebAudio audible fallback.

## Release semantics

### Native Bass

Explicit release is source-proven:

```text
pointer down → performanceNoteOn → bassNoteOn
pointer up/cancel/lost capture → performanceNoteOff → bassNoteOff
component unmount → performanceAllNotesOff → bassAllNotesOff
```

### Browser instruments

The existing `triggerPart()` API does not return a public per-note release handle. It schedules finite note duration through `gateSec`.

Therefore browser `noteOff` currently reports `releaseMode = gate`; this must not be described as an explicit note-off implementation.

Required later browser-runtime work:

- introduce a reusable performance voice handle/token around existing browser engines,
- implement explicit `noteOff(token|note)` without creating a second voice allocator,
- expose a browser `allNotesOff` performance boundary,
- preserve scheduler-triggered finite gates.

## Native 3D Synth gap

`TrackMode::Synth` in Groove is routing metadata, not proof of a synthesizer renderer.

Current native C++ modules include engine/platform/graph/groove/bass/voice infrastructure. A dedicated native 3D Synth engine/node and its Kotlin/JNI live-note bridge have not been source-proven.

Until that changes, Native 3D Synth keyboard input is intentionally rejected by `performanceInput.ts` instead of starting WebAudio.

## Verification still required

All of the following remain NOT EXECUTED:

- TypeScript typecheck
- unit tests
- Android native build
- JNI link
- APK build/install/launch
- Bass keyboard on a physical Android device
- multitouch note-on/off stress
- app-background all-notes-off
- audio-focus recovery
- callback timing
- latency
- XRuns
- CPU/RAM

No performance value is claimed by this matrix.
