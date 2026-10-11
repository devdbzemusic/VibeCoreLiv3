# VibeCoreLiv3 — Parameter Hub v1

Status: `FOUNDATION IMPLEMENTED / CALLER MIGRATION PARTIAL / NOT EXECUTED`  
Date: 2026-09-16

## Purpose

VibeCore v4 requires one parameter authority. The Parameter Hub must not become a second state store.

Current implementation:

```text
UI / MIDI / Automation / AI
→ Parameter Hub
→ existing authoritative Zustand actions/state
→ existing runtime bindings
```

The Hub owns:

- stable parameter IDs
- range/unit metadata
- validation/clamping
- routing to the authoritative action
- selective subscriptions
- future gesture/automation/MIDI-learn hooks

The Hub does **not** own parameter values.

## Implemented IDs

- `transport.bpm`
- `master.volume`
- `part.<id>.volume`
- `part.<id>.pan`

These are intentionally the first parameters because their current project-state ownership is unambiguous.

## API

```ts
getParameterDescriptor(id)
getParameter(id)
setParameter(id, value)
subscribeParameter(id, listener)
beginParameterGesture(id)
endParameterGesture(id)
```

`begin/endParameterGesture` are currently stateless no-ops. They exist to stabilize the contract without inventing a hidden gesture state before undo/automation batching is designed.

## Subscription model

`subscribeParameter()` uses the existing Zustand subscription and compares only the selected parameter value before notifying its listener.

This avoids:

- another event store
- polling
- audio-rate React updates
- whole-store UI invalidation for one control

## Voice parameters

Native Voice DSP parameters are **not** added to the Hub yet.

Reason: Native Voice has real runtime parameters, but the current project/store model does not yet have an authoritative persisted Voice-DSP state. Putting those values into Parameter Hub-local memory would create a second/hidden state authority.

Required order:

1. define persistable Voice project state/schema,
2. define migration/defaults,
3. route it through the authoritative store,
4. let Parameter Hub proxy that state,
5. let RuntimeVoice apply it to the selected renderer.

## Future IDs (planned, not implemented)

Examples only:

- `voice.pitch.semitones`
- `voice.formant.semitones`
- `voice.volume`
- `voice.dryWet`
- `voice.monitor`
- `voice.stereo.width`
- `synth3d.filter.cutoff`
- `bass3d.glide`
- `brainwave.mix`
- `fx.bus.1.delay.feedback`

These names do not imply implementation.

## Migration rule

No UI control should be migrated merely to increase Parameter-Hub coverage. A parameter may enter the Hub only when:

- ownership is clear,
- units/range are defined,
- persistence semantics are known,
- runtime mapping is known where applicable,
- no second source of truth is introduced.

## Verification

STATICALLY VERIFIED:

- Parameter Hub v1 owns no values.
- implemented IDs route to existing store actions.
- subscriptions are selective by value comparison.

NOT EXECUTED:

- TypeScript typecheck
- unit tests
- UI caller migration
- MIDI learn
- automation write/read
- undo gesture batching
- performance/render-count measurements
