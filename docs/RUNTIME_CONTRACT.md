# VibeCoreLiv3 — Runtime Contract

Status: ACCEPTED FOR IMPLEMENTATION
Date: 2026-09-16
Basis: ADR-0002 — Runtime Authority & Call-Graph Truth

## Purpose

Provide exactly one frontend-facing boundary for audible runtime commands while keeping decode/analysis/offline asset work separate.

The UI must not call WebAudio or Native bridge musical/rendering APIs directly.

## Runtime ownership

```text
UI / Domain Commands
        ↓
VibeCoreRuntime
 ├ Transport
 ├ PerformanceInput
 ├ Preview
 ├ ProjectMirror
 ├ Parameters
 ├ Diagnostics
 └ Capabilities
        ↓
Runtime Adapter
 ├ WebAudioRuntimeAdapter
 └ NativeAndroidRuntimeAdapter
```

Only one adapter may own audible rendering at a time.

### Android Native mode

When native audio capability is selected and available:

- Native Oboe Runtime owns audible output.
- Native VibeCoreSync owns real-time musical scheduling.
- browser WebAudio musical rendering is forbidden unless a capability exception is explicit and documented.
- browser decode/offline analysis remains allowed if it does not connect an audible graph.

### Browser/Web mode

When native audio is unavailable/not selected:

- existing WebAudio engine owns audible output.
- MasterClock + browser look-ahead scheduler provide the browser timing implementation.
- the browser adapter wraps existing code; it must not duplicate the engine.

## Contract domains

### Runtime lifecycle

- `start()`
- `suspend()`
- `resume()`
- `shutdown()`
- `getBackendInfo()`
- `isReady()`

Lifecycle calls must be idempotent where practical.

### Transport

- `play()`
- `stop()`
- `reset()`
- `seek(position)`
- `setTempo(bpm)`
- `getPosition()`
- `subscribeTransport(listener)`

All transport UI surfaces use this domain. TopBar and Performance may not implement different startup semantics.

### Performance input

- `noteOn(input)`
- `noteOff(input)`
- `allNotesOff(scope?)`
- `triggerSample(input)`
- `triggerRegion(input)`

Required semantics:

- pointer/key/MIDI down maps to `noteOn`
- pointer/key/MIDI up/cancel/leave/app pause maps to `noteOff` or `allNotesOff`
- UI must not require access to `AudioContext.currentTime`
- runtime adapter chooses timestamp/command strategy

### Preview

- `playBufferPreview(asset, options)`
- `playRegionPreview(asset, region, options)`
- `stopPreview(id?)`

Sample Forge and Forge auditions use this domain. Native mode may implement preview by native sample loading/triggering or another explicit native preview path.

### Project mirror

Native runtime requires an explicit mirror from authoritative project state to native sequencer/instrument state.

Minimum operations:

- `replaceProjectSnapshot(snapshot)`
- `setPattern(pattern)`
- `setScene(scene)`
- `setStep(stepMutation)`
- `setNotes(noteMutation)`
- `setTrackState(trackMutation)`
- `setRouting(routingMutation)`
- `setSampleAssignment(sampleMutation)`

A project revision/generation number must be carried so stale native mutations can be rejected or rebuilt.

No second persistent state store is created; Native runtime state is an execution mirror of the authoritative project state.

### Parameters

- `setParameter(id, value, metadata?)`
- `getParameter(id)`
- `subscribeParameter(id, listener)`
- `beginGesture(id)`
- `endGesture(id)`
- `applyParameterBatch(changes)`

Future Parameter Hub sits above/adjoins this runtime domain. Runtime adapters receive normalized validated parameter changes rather than UI-specific setters.

### Diagnostics

- `snapshot()`
- `getBackendInfo()`
- `getLatency()`
- `getXRuns()`
- `getAudioLoad()`
- `getClockState()`
- `getRuntimeWarnings()`

A diagnostic method existing does not make its output VERIFIED. Measurement claims require actual execution evidence.

### Capabilities

- `hasCapability(id)`
- `getCapabilities()`

Capabilities control visibility/availability and runtime routing. They do not silently change architectural ownership.

## Separate AudioAssetService

The following work is not an audible runtime command and may remain browser/offline/native according to capability/performance:

```text
AudioAssetService
├ decodeFile
├ decodeBytes
├ toPCM
├ transformOffline
├ renderOfflineAsset
├ buildWaveform
├ analyzeTempoKeyEnergy
├ cacheAsset
└ releaseAsset
```

Rules:

- decode/analysis must not connect to audible output by accident
- cached assets have stable IDs/revisions
- audible preview still returns through `VibeCoreRuntime.Preview`

## Timing types

Raw generic `tick: number` must not cross runtime boundaries.

Required logical types:

- `BeatPosition`
- `Clock24Tick` — browser MasterClock 24 ticks/beat
- `SixteenthStep` — browser sequencer step unit
- `NativePpq1920Tick` — native PPQ 1920

Conversions are explicit named functions and unit-tested.

Known relation in current 4/4 step model:

```text
1 beat = 4 SixteenthStep
1 beat = 24 Clock24Tick
1 beat = 1920 NativePpq1920Tick
1 SixteenthStep = 480 NativePpq1920Tick
```

## Runtime-selection rule

Runtime selection happens in one owner/factory only.

Forbidden after migration:

- UI checking `window.VibeCoreNative`
- UI calling `ensureAudio()` merely to start transport
- UI calling `triggerPart()` directly
- UI calling Native bridge methods directly
- feature modules starting audible WebAudio graphs without runtime capability routing

Temporary legacy call sites may exist only while explicitly listed in the migration inventory.

## Error model

Typed failures must distinguish at least:

- validation
- unsupported capability
- runtime unavailable
- lifecycle state
- bridge unavailable
- native library unavailable
- stream open/start failure
- asset/resource failure
- stale project revision
- unsupported runtime feature

Fallback must be explicit. A native startup failure may not silently create a half-native/half-WebAudio session.

## Performance rules

- no file/network/UI work on native audio callback
- no blocking or unbounded logging in audio callback
- no repeated decode when a valid cache exists
- no React render dependency for real-time parameter writes
- UI diagnostics are rate-limited
- meters/playheads are observers, not timing authorities
- audio probes are diagnostics only
- Native render path avoids WebView audio graph creation for normal musical commands

## Migration order

1. Add Runtime facade types + selection owner with no behavior change.
2. Wrap existing WebAudio engine in `WebAudioRuntimeAdapter` by delegation, not rewrite.
3. Wrap/extend current `nativeAudioRuntime` + `NativeOboeBackend` in `NativeAndroidRuntimeAdapter`.
4. Add explicit timing-unit types/converters and tests.
5. Unify TopBar and Performance transport through Runtime Transport.
6. Route InstrumentKeyboard through PerformanceInput with note-on/off lifecycle.
7. Route Sample Forge/Forge previews through Preview.
8. Implement Store → Native ProjectMirror.
9. Route auxiliary audible engines (bRAINWAVEz, Spatial, granular, etc.) by capability/runtime policy.
10. Remove legacy direct audible entry points only after equivalent tests pass.

## Verification gates

Static contract tests:

- runtime factory selects exactly one adapter
- no native bridge → Web adapter
- native bridge available → Native adapter
- explicit failure state prevents mixed runtime
- timing conversions exact
- UI transport entry points use Runtime API
- performance input releases notes on all cancellation paths
- ProjectMirror revision ordering

Real-device gate later:

- APK build/install/launch
- Native bridge available
- Oboe stream active
- callback activity
- project state mirrored
- expected audible pattern
- browser scheduler unarmed
- no unintended audible WebAudio graph
- lifecycle/device recovery
- measured latency/xRuns/jitter/CPU/RAM/callback budget

Until executed, all real-device metrics remain `UNKNOWN` / `NOT EXECUTED`.

## Migration safety

Use REUSE → EXTEND → NEW.

No second scheduler, second authoritative persistent state store, second parameter authority or duplicate DSP implementation is authorized by this contract.
