# VibeCoreLiv3 — Voice Runtime Contract Audit

Status: `STATICALLY VERIFIED AUDIT / RUNTIME NOT EXECUTED`  
Date: 2026-09-16

## Scope

This audit compares the current `VoiceTab` frontend semantics with the source-proven Android Native Voice runtime.

It does **not** claim that Native Voice has executed on a device.

---

## 1. Source-proven Native Voice chain

```text
NativeAudioBridge.kt
→ JNI jni_voice_bridge.cpp
→ VoiceEngine
→ VoiceNode command queue
→ Voice DSP / Voice units
→ AudioGraph
→ Oboe output
```

The Native Voice runtime exposes real module-specific state and commands for:

- global mode: Live / Sample / Instrument / Texture
- poly mode: Mono / Legato / Poly4 / Poly8
- play mode: OneShot / Loop / Slice
- volume
- dry/wet
- live monitor
- glide
- active sample slot
- root note
- pitch semitones + enable
- formant semitones + enable
- 4 harmony voices + harmony master + enable
- doubler
- gate
- de-esser
- compressor
- EQ
- breath
- texture cutoff/resonance
- envelope 0/1
- LFO 0/1
- macros
- modulation matrix
- stereo width/mid/side/pan + enable
- noteOn / noteOff / allNotesOff
- 8 sample slots
- slice markers
- live-input enable/query
- undo/redo
- active-unit/output/input-level queries

This is a distinct instrument/effect runtime, not merely a generic Part channel strip.

---

## 2. Current VoiceTab frontend truth

The current `VoiceTab` reads and writes generic Groove/Part state.

Visible primary controls map as follows:

| VoiceTab label | Current frontend write | Native Voice equivalent | Result |
|---|---|---|---|
| PITCH | `setPartPitch(part.id, -24..24)` | `voiceSetPitchSemitones(-24..24)` + enable | semantic overlap, currently not connected |
| VOLUME | `setPartVolume(part.id, 0..100)` | `voiceSetVolume(0..2)` | different domain/runtime |
| PAN | `setPartPan(part.id, -50..50)` | `voiceSetStereoPan(...)` | conceptual overlap, different domain/runtime |
| FORMANT | `setChannel(part.id, { lpCut: 0..100 })` | `voiceSetFormantSemitones(-12..12)` + enable | **semantic mismatch** |
| STRETCH | `setWaveEdit(part.id, { timeStretch })` | no direct Native Voice stretch setter | no 1:1 mapping |
| DRIVE | `setChannel(part.id, { drive })` | no dedicated Native Voice drive command | no 1:1 mapping |
| REVERB | `setSend(part.id, 0, value)` | no Voice-local reverb command | routing-level parameter, not Voice DSP |
| DELAY | `setSend(part.id, 1, value)` | no Voice-local delay command | routing-level parameter, not Voice DSP |

Therefore the current 8-knob UI must **not** simply be redirected method-by-method to Native Voice.

---

## 3. Recording mismatch

Current record button:

```text
VoiceTab
→ toggleRec()
→ generic Store recording boolean
```

Source-proven Native live input:

```text
voiceSetLiveInputEnabled(true)
→ JNI
→ VoiceEngine::setLiveInputEnabled
→ VoiceInput.open(sampleRate, maxFrames)
→ setActive(true)
→ VoiceNode LiveInput command
```

These are not the same operation.

The current label `RECORDING` therefore does not prove:

- microphone/input stream opened,
- Native Voice input active,
- audio captured,
- monitoring active,
- a take was recorded.

A RuntimeVoice recording/input contract is required before the UI may claim those states as Native runtime truth.

---

## 4. Waveform / takes truth

`WaveformDisplay` is currently a visual placeholder derived from `recording` and scene note count. It is not a waveform derived from Native Voice input PCM.

The take list displays scene `Note[]` objects. It is therefore currently closer to a vocal/melodic note editor than an audio-take recorder.

This is valid product functionality, but it must be named and wired truthfully.

---

## 5. AI truth

Voice AI functions currently operate on note data:

```text
scene Note[]
→ voiceAssistant suggestions
→ setNotes(part.id, ...)
```

They do not directly mutate Native Voice DSP and do not currently flow through a universal AI Intent → Validation → Runtime Command contract.

This remains separate from the Native Voice engine audit.

---

## 6. Required architecture

Do not wire `VoiceTab` directly to `window.VibeCoreNative`.

Required boundary:

```text
Voice UI / AI / MIDI
→ RuntimeVoice / ParameterHub
   ├ Voice musical state / project state
   ├ Voice realtime parameter commands
   ├ live-input lifecycle
   ├ performance note lifecycle
   ├ sample-slot lifecycle
   └ diagnostics
→ runtime adapter
   ├ Browser Voice adapter
   └ Native Voice adapter
```

Generic Part routing remains outside the Voice DSP contract:

```text
Part/Mixer routing
├ channel volume/pan
├ FX sends
└ bus/master routing
```

A Voice parameter may intentionally affect both domains only through an explicit composite command.

---

## 7. Proposed parameter ownership

### Voice-runtime owned

- voice.pitch.semitones
- voice.pitch.enabled
- voice.formant.semitones
- voice.formant.enabled
- voice.volume
- voice.dryWet
- voice.monitor
- voice.glideMs
- voice.mode.global
- voice.mode.poly
- voice.mode.play
- voice.sample.activeSlot
- voice.sample.rootNote
- voice.harmony.*
- voice.doubler.*
- voice.gate.*
- voice.deEsser.*
- voice.compressor.*
- voice.eq.*
- voice.breath.*
- voice.texture.*
- voice.env.0.* / voice.env.1.*
- voice.lfo.0.* / voice.lfo.1.*
- voice.macro.1 / voice.macro.2
- voice.mod.*
- voice.stereo.*
- voice.liveInput.enabled

### Project / Part / Mixer owned

- selected Voice Part
- note arrangement / piano-roll notes
- Part output volume/pan where used as mixer controls
- FX sends
- bus routing
- project persistence
- AI proposal/history

These ownership groups must not silently mirror into each other.

---

## 8. Migration rule for existing 8-parameter UI

Do **not** preserve a misleading label just to preserve layout.

Recommended split:

### Performance Voice controls

- PITCH
- FORMANT
- VOICE VOL
- DRY/WET
- MONITOR
- HARMONY
- GLIDE
- WIDTH

These have meaningful Native Voice equivalents.

### Mix / routing controls

- Part volume
- Part pan
- Reverb send
- Delay send
- generic channel drive

Keep these in Mix/advanced routing rather than presenting them as Voice-engine internals.

### Stretch

Keep as sample/take editing functionality unless/until a Voice-runtime time-stretch contract exists.

---

## 9. Live-input state model required

A minimum RuntimeVoice live-input state should expose:

```ts
interface RuntimeVoiceInputStatus {
  capability: "supported" | "unsupported" | "unknown";
  requested: boolean;
  active: boolean;
  monitoring: boolean;
  inputLevel: number | null;
  error: string | null;
}
```

`requested` and `active` must remain distinct so the UI does not claim recording/input success merely because the user tapped a button.

---

## 10. Verification status

STATICALLY VERIFIED:

- Native Voice module and JNI chain exist.
- Native Voice has dedicated parameter semantics.
- Native live-input lifecycle exists.
- Native Voice supports 8 sample slots.
- Current VoiceTab writes generic Part/store parameters rather than Native Voice parameters.
- Current waveform is synthetic UI visualization, not input PCM evidence.

NOT EXECUTED:

- microphone permission/runtime
- input stream open
- Native Voice monitoring
- input/output level queries on device
- Voice DSP audio output
- recording/capture
- pitch/formant audible behavior
- CPU/RAM/latency/xRuns

---

## Decision

`VoiceTab` must not be treated as already wired to Native Voice.

Next implementation step is a **RuntimeVoice contract + adapter surface**, followed by selective migration of semantically valid controls. Recording/live-input UI must be driven by runtime status rather than the generic store recording boolean.
