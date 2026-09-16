# Native Groove Asset Contract

Status: **CONTRACT DEFINED / PCM UPLOAD NOT IMPLEMENTED**  
Date: 2026-09-16  
Branch: `revision/v4-runtime-consolidation`

## Purpose

Close the remaining gap between Web project sample assignment and Native Groove playback without inventing sample IDs, stealing Voice slots, or publishing pointers whose lifetime is not safe on the audio thread.

## Source-proven facts

1. Native Groove supports `kMaxSamples = 128`.
2. Every `Track` stores `sampleId`, default `-1`.
3. `StepSequencer` copies its configured sample ID into every emitted `Trigger`.
4. `PianoRoll` also emits the track sample ID.
5. `GrooveNode::process()` sends Drum/Sample/default triggers to the Groove `VoicePool`.
6. `VoicePool::trigger()` drops a trigger when its sample ID is outside range or the registered `SampleBuffer` is invalid.
7. `GrooveNode::registerSample(id, SampleBuffer)` and `GrooveEngine::registerSample(...)` exist in C++.
8. Kotlin/JNI expose `grooveSetTrackSample(track,id)` but currently expose **no Groove PCM upload/register API**.
9. The only JS-exposed PCM upload today is `voiceLoadSample(...)`, which belongs to the separate VoiceEngine sample-slot system and must not be reused as a Groove sample bank.
10. `GrooveNode::registerSample()` is documented for registration before stream start. Calling it concurrently with the running callback would write the sample table from the UI thread while the audio thread may read it.
11. VoiceEngine already owns a safe sample-memory pattern: UI-thread PCM ownership + published pointer views + deferred/epoch-gated reclamation.

## Canonical v1 asset ID

For sample-domain Parts:

```text
nativeGrooveSampleId = Part.id
```

Rationale:

- WebAudio already stores the audible per-Part buffer by `partId`.
- VibeCore currently has 16 Parts.
- Native Groove allows IDs `0..127`.
- Reusing `Part.id` creates no second persisted asset-ID namespace.
- Synth and Bass authorities do not receive Groove sample IDs.

The TypeScript authority is `src/lib/runtime/nativeGrooveAssets.ts`.

## Registration truth

A sample ID MUST NOT be assigned to a Native Groove track merely because:

- `Part.sampleName` is present,
- WebAudio has a buffer,
- a deterministic ID can be calculated.

It may be assigned only after Native PCM registration has returned success for the current engine/sample-bank session.

`nativeGrooveAssetRegistry` is session-only registration evidence. It is not project state and must never replace Zustand/project asset ownership.

## Current mirror behavior

`mirrorCurrentSceneToNative()` now:

- assigns a registered sample-domain `Part.id` only when the session registry confirms Native registration,
- otherwise writes `grooveSetTrackSample(track, -1)`,
- writes `-1` for Synth/Bass authority tracks,
- reports `assignedSamples` and `missingRegisteredSamples`,
- therefore cannot accidentally keep a stale track sample assignment from an earlier mirror.

## Required Native PCM upload contract

Target surface (names provisional until implementation):

```text
AudioAssetService / JS
  -> grooveLoadSample(sampleId, monoPcm, sampleRate)
  -> Kotlin marshalling-only bridge
  -> JNI marshalling-only function
  -> GrooveEngine::loadSample(...)
  -> engine-owned PCM storage
  -> GrooveNode / VoicePool published SampleBuffer view
```

Requirements:

- ID range: `0..127`.
- PCM format: mono float32.
- sample rate explicit.
- invalid/empty PCM rejected.
- no heap allocation, file I/O, JNI, locks or free operations on the audio callback.
- Native owner copies incoming PCM on a non-audio thread.
- Pointer published to Groove VoicePool remains valid for every active voice that can still reference it.
- replacement/clear must use a safe deferred reclamation protocol; reuse VoiceEngine's epoch-gated pattern rather than creating a second memory model.
- JNI owns no long-lived PCM buffer.
- Kotlin owns no authoritative sample bank.
- JS registry is marked registered only after Native upload success.

## Lifecycle order

Current application order is:

```text
start Native engine
-> mirror scene
```

That is sufficient for structural Groove commands but is not the final PCM hydration order because the existing C++ registration API is documented pre-stream.

Target cold-start order:

```text
resolve/decode project assets
-> create/ensure Native graph objects
-> load/register Native Groove PCM assets while safe
-> start Native audio stream
-> mirror track sample IDs + scene/pattern state
-> transport play
```

If hot sample replacement is required while the stream is running, it must use the epoch/deferred-free protocol and a command/publish boundary designed for that purpose. Do not call the existing direct `registerSample()` concurrently and call it safe.

## Decode boundary

The current Web sample loader calls `ensureAudio()` before `decodeAudioData()`. On a Native runtime this can construct the full WebAudio render graph, which is incompatible with strict one-renderer authority.

Therefore PCM upload completion also requires a decode-only asset service that does **not** activate the audible WebAudio renderer. Candidate implementation should reuse browser decoding only as an asset service (for example a decode-only BaseAudioContext/OfflineAudioContext path where supported), then convert/downmix to the Native mono PCM contract.

This decode separation is a prerequisite for calling Native sample hydration complete.

## Verification gates

Before this contract can become VERIFIED:

1. Native PCM upload API source-correlated JS -> Kotlin -> JNI -> C++.
2. Buffer lifetime/replacement test proves no use-after-free under active voices.
3. Native sample-ID assignment test proves unregistered IDs remain `-1`.
4. Cold-start project hydration with at least Kick/Snare/Hat/Sample loaded.
5. Hot replacement test if runtime replacement is supported.
6. Stop/Play must preserve registrations when engine remains alive.
7. Full `stopEngine`/engine recreate must invalidate/rebuild session registration truth as appropriate.
8. APK/device audio proof.

Until these gates execute, Native Groove sample playback remains **PARTIAL / NOT VERIFIED**.
