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

| Instrument / command | Browser WebAudio | Android Native | Current status |
|---|---|---|---|
| 3D Bass noteOn | `triggerPart → trigger3DBass → Bass3D voiceEngine` | `bassNoteOn → Kotlin → JNI → BassEngine → BassNode` | Source routes STATICALLY VERIFIED; execution NOT EXECUTED |
| 3D Bass noteOff | `performanceInput → releaseNote3DBass → existing voice.steal(releaseSec)` | `bassNoteOff → Kotlin → JNI → BassEngine → BassNode` | Static route exists; browser async-registration race still OPEN |
| 3D Bass allNotesOff | `killAllNotes3DBass(partId)` | `bassAllNotesOff → Kotlin → JNI → BassEngine → BassNode` | STATICALLY VERIFIED route |
| 3D Synth noteOn | `triggerPart → trigger3DSynth → Synth3D voiceEngine` | no dedicated native 3D Synth renderer/bridge proven | Browser route STATICALLY VERIFIED; Native UNSUPPORTED |
| 3D Synth noteOff | `performanceInput → releaseNote3D → existing voice.steal(releaseSec)` | no native route proven | Browser static route exists; Native UNSUPPORTED; async-registration race OPEN |
| 3D Synth allNotesOff | `killAllNotes3D(partId)` | no native route proven | Browser STATICALLY VERIFIED route; Native UNSUPPORTED |
| Voice noteOn/off | browser Voice paths exist separately | `voiceNoteOn/voiceNoteOff/voiceAllNotesOff → JNI → VoiceEngine → VoiceNode` | Native STATICALLY VERIFIED; frontend caller migration incomplete |
| Generic Part noteOn/off | `triggerPart`, release generally gate-based | generic `AudioBackend.noteOn` maps to **Voice**, not arbitrary Part/Bass/Synth | Native generic route MUST NOT be used |

## Implemented frontend boundary

`src/lib/runtime/performanceInput.ts` is the live-performance authority for migrated UI components.

```text
InstrumentKeyboard
  → performanceNoteOn / performanceNoteOff / performanceAllNotesOff
  → selected runtime
     ├─ Browser
     │   ├─ noteOn → existing triggerPart
     │   ├─ Synth3D key-up → releaseNote3D
     │   ├─ Bass3D key-up → releaseNote3DBass
     │   └─ generic Part → scheduled gate
     └─ Native
         ├─ Bass3D → bassNoteOn/off/allNotesOff
         ├─ Synth3D → unsupported
         └─ Generic Part → unsupported until explicitly mapped
```

The keyboard derives the runtime instrument from canonical `Part.synth.engine` when the caller does not provide an explicit route:

- `3D Bass` → `bass3d`
- `3D` → `synth3d`
- anything else → `part`

This prevents silent Native→WebAudio audible fallback.

## Keyboard lifecycle hardening

The keyboard now reserves pointer ownership **before** awaiting runtime activation. A pointer can therefore enter one of two states:

```text
pointerDown
→ reserve {midi, instrument, accepted=false, released=false}
→ await performanceNoteOn
```

If `pointerUp`, `pointerCancel`, `lostPointerCapture` or component unmount occurs while note-on is still pending, `released=true` is retained. If note-on later succeeds, the keyboard immediately emits the matching Runtime note-off instead of leaving a late-starting note alive.

This fixes the UI-level async startup race.

## Browser 3D release semantics

A source audit found that `Synth3DSynthVoice.noteOff()` and `Bass3DVoice.noteOff()` do not shorten the amp ADSR that was already scheduled at note-on. They mostly adjust cleanup timing. Therefore those methods are **not** used as proof of early key release.

Both voice types already contain a `steal(fadeSec)` primitive which:

1. cancels scheduled amp-gain automation at current audio time,
2. holds the current gain value,
3. fades to silence,
4. schedules cleanup.

Live browser key-up reuses this existing primitive with the patch's amp-release duration. No second allocator or voice manager was created.

## Remaining browser async-registration gap

`triggerPart()` defines `playSynth()` as async and calls it without awaiting it. 3D Synth/Bass are loaded by dynamic import. Consequently:

```text
performanceNoteOn()
→ triggerPart()
→ playSynth() starts
→ dynamic import pending
→ triggerPart() may return
→ 3D voice registers later
```

The keyboard's pending-pointer guard prevents a lost UI release, but the Browser Runtime still lacks a formal acknowledgement that a particular 3D voice has been registered before `performanceNoteOn()` resolves.

Therefore the current browser 3D key-up path is classified:

`STATICALLY WIRED / REGISTRATION ACK CONTRACT OPEN`

Required follow-up is to expose an awaitable/tokenized 3D performance trigger **using the existing voice engines**, not create a second engine.

## Native 3D Synth gap

`TrackMode::Synth` in Groove is routing metadata, not proof of a synthesizer renderer.

Current native C++ modules include engine/platform/graph/groove/bass/voice infrastructure. A dedicated native 3D Synth engine/node and its Kotlin/JNI live-note bridge have not been source-proven.

Until that changes, Native 3D Synth keyboard input is intentionally rejected instead of starting WebAudio.

## Verification still required

All of the following remain NOT EXECUTED:

- TypeScript typecheck
- unit tests
- Android native build
- JNI link
- APK build/install/launch
- browser keyboard rapid-tap test
- Bass keyboard on a physical Android device
- multitouch note-on/off stress
- app-background all-notes-off
- audio-focus recovery
- callback timing
- latency
- XRuns
- CPU/RAM

No performance value is claimed by this matrix.
