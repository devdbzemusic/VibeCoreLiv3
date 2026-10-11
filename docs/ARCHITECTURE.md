# VibeCoreLiv3 — Architecture

Stand: 2026-09-16

## Authority

Canonical engineering specification:

`docs/VibeCore_Univers_SUPREME_MasterPrompt_UNIFIED_v4.0.md`

This document describes the current target architecture derived from that specification. It does not override the MasterPrompt.

## Architectural invariants

VibeCore must converge on exactly one authoritative implementation for each core concern:

- musical master sync / transport
- audio clock model
- parameter hub
- persistent state / preset / undo
- asset index
- AI intent layer
- capability registry

No new parallel implementation may be introduced during the revision.

## Target runtime flow

```text
React UI
  ↓
Domain Commands / Parameter Hub
  ↓
VibeCore Runtime API
  ├── WebAudioBackend
  └── NativeAndroidBackend
        ↓
      Kotlin Bridge
        ↓
      JNI
        ↓
      C++ / Oboe
```

The UI must not make platform/backend ownership decisions directly.

## Timing ownership

`VibeCore Sync` is the sole authoritative musical timebase.

All synchronized domains must derive timing from it:

- Groove / Sequencer
- Piano Roll playback
- Arpeggiator
- synchronized LFO/modulation
- delay sync
- Motion Recorder
- AI timing
- MIDI/OSC/external sync

Independent visual timers are allowed only for UI sampling/animation and must not become musical clocks.

## State ownership

One authoritative persistent state system is retained.

Domain separation should be implemented through typed slices/contracts/commands rather than separate competing stores.

Persisted state includes musical/project intent. Transient runtime telemetry must remain outside persisted project state where possible.

### Persisted examples

- patterns/scenes/steps/notes
- sample references and editable sample metadata
- routing
- parameters
- presets
- automation/motion data
- project/session settings

### Transient examples

- meters
- FPS
- current voice counters
- current drag state
- temporary analyzer frames
- cache statistics
- runtime diagnostics

## Parameter ownership

Target path:

```text
UI / MIDI / Automation / AI / Preset / Motion
                  ↓
             Parameter Hub
                  ↓
        Domain / Runtime Command
                  ↓
            State + DSP target
```

No UI-specific parameter truth may diverge from runtime/state truth.

## Instrument boundaries

### Sample context

Sample slots remain sample/audio contexts.

Permitted examples:

- playback
- slicing
- reverse
- pitch/time processing
- granular transformation
- freeze
- FX
- routing
- automation

### 3D Synth

All general synthesizer voice generation belongs to the 3D Synth context.

### 3D Bass

Bass synthesis/performance belongs to the 3D Bass context.

Legacy `sample | synth | hybrid` states require an explicit migration strategy and must not be silently reinterpreted.

## Capability ownership

A central Capability Registry will become the only source for runtime/platform feature availability.

Planned examples:

- `audio.web`
- `audio.native`
- `audio.lowLatency`
- `audio.input`
- `audio.playbackCapture`
- `midi.input`
- `midi.output`
- `sync.midi`
- `sync.link`
- `voice.input`
- `remix.liveInput`
- `remix.deviceCapture`
- `synth3d`
- `bass3d`
- `brainwave`
- `storage.persistent`
- `storage.export`

## Caching architecture

Caches are derived/transient infrastructure and do not become a second project-state system.

Planned cache domains:

1. raw asset/file cache
2. decoded PCM cache
3. resampled PCM cache
4. waveform peak pyramid cache
5. BPM/key/energy/transient analysis cache
6. AI context cache
7. native voice/sample/scratch-buffer pools

All caches require explicit invalidation/version keys and memory budgets.

## AI architecture

Required path:

```text
User
 → AI
 → Intent
 → Validation
 → Command / Parameter Layer
 → System
```

Operations must distinguish:

- Suggest
- Preview
- Apply
- Revert
- Explain

AI may not mutate internal runtime/state directly outside this boundary.

## Change rule

Architecture-changing work requires:

- ADR
- impact analysis
- migration strategy where state/contracts change
- rollback strategy
- verification status
