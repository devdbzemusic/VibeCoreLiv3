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
| 3D Bass noteOn | `triggerPart → trigger3DBass → Bass3D voiceEngine → registration ack` | `bassNoteOn → Kotlin → JNI → BassEngine → BassNode` | Source routes STATICALLY VERIFIED; execution NOT EXECUTED |
| 3D Bass noteOff | `performanceInput → releaseNote3DBass → existing voice.steal(releaseSec)` | `bassNoteOff → Kotlin → JNI → BassEngine → BassNode` | STATICALLY VERIFIED route |
| 3D Bass allNotesOff | `killAllNotes3DBass(partId)` | `bassAllNotesOff → Kotlin → JNI → BassEngine → BassNode` | STATICALLY VERIFIED route |
| 3D Synth noteOn | `triggerPart → trigger3DSynth → Synth3D voiceEngine → registration ack` | no dedicated native 3D Synth renderer/bridge proven | Browser route STATICALLY VERIFIED; Native UNSUPPORTED |
| 3D Synth noteOff | `performanceInput → releaseNote3D → existing voice.steal(releaseSec)` | no native route proven | Browser STATICALLY VERIFIED route; Native UNSUPPORTED |
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
     │   ├─ arm 3D registration waiter
     │   ├─ noteOn → existing triggerPart
     │   ├─ wait for existing voice engine acknowledgement
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

The keyboard reserves pointer ownership **before** awaiting runtime activation:

```text
pointerDown
→ reserve {midi, instrument, accepted=false, released=false}
→ await performanceNoteOn
```

If `pointerUp`, `pointerCancel`, `lostPointerCapture` or component unmount occurs while note-on is still pending, `released=true` is retained. If note-on later succeeds, the keyboard immediately emits the matching Runtime note-off instead of leaving a late-starting note alive.

## Browser 3D registration acknowledgement

`triggerPart()` intentionally keeps a scheduler-friendly void API and starts its 3D `playSynth()` branch asynchronously because the 3D modules are dynamically imported.

Instead of changing the scheduler contract or creating a second trigger path, the existing voice engines now expose one-shot registration waiters:

```text
PerformanceInput
→ arm waitForNoteStart3D / waitForNoteStart3DBass
→ triggerPart
→ dynamic import
→ existing triggerNote3D / triggerNote3DBass
→ ActiveNote inserted into existing engine
→ notifyNoteStarted
→ PerformanceInput resolves accepted=true
```

If no voice registration arrives within the bounded acknowledgement window, PerformanceInput returns a failed note-on rather than falsely claiming a voice exists.

This closes the previously documented browser 3D registration-acknowledgement gap at the static contract level.

## Browser 3D release semantics

A source audit found that `Synth3DSynthVoice.noteOff()` and `Bass3DVoice.noteOff()` do not shorten the amp ADSR already scheduled at note-on. They mostly adjust cleanup timing. Therefore those methods are **not** used as proof of early key release.

Both voice types already contain a `steal(fadeSec)` primitive which:

1. cancels scheduled amp-gain automation at current audio time,
2. holds the current gain value,
3. fades to silence,
4. schedules cleanup.

Live browser key-up reuses this existing primitive with the patch's amp-release duration. No second allocator or voice manager was created.

## Bass legato allocator leak fixed

During this audit a pre-existing Bass 3D legato/glide issue was found:

1. `triggerNote3DBass()` requested a new global voice-allocation handle,
2. the glide path reused the already-active Bass voice,
3. the function returned without using or releasing the newly requested handle.

The glide path now releases that unused handle before returning and emits the normal registration acknowledgement for the re-pitched active voice.

This is a static code correction only; runtime voice-count behavior is still `NOT EXECUTED`.

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
- Browser 3D registration timeout test
- Bass legato repeated-glide allocator-count test
- Bass keyboard on a physical Android device
- multitouch note-on/off stress
- app-background all-notes-off
- audio-focus recovery
- callback timing
- latency
- XRuns
- CPU/RAM

No performance value is claimed by this matrix.
