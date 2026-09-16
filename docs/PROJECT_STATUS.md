# VibeCoreLiv3 — Project Status

Stand: 2026-09-16  
Branch: `revision/v4-runtime-consolidation`  
PR: `#1` — Draft, not merged

## Canonical engineering source

Normative engineering specification:

`docs/VibeCore_Univers_SUPREME_MasterPrompt_UNIFIED_v4.0.md`

Older prompts/reports remain historical or supporting material unless explicitly marked otherwise.

## Current phase

**RUNTIME CONSOLIDATION + LOCAL VERIFICATION HANDOVER**

The branch now contains substantial implementation, not only planning. The remaining immediate work is compile/test/device verification plus a deliberately small Sample Forge UI integration patch. Broad feature expansion is not authorized during this verification pass.

## Verification language

The branch is currently:

**STATICALLY VERIFIED / NOT YET LOCALLY EXECUTED**

No successful local typecheck, lint, Vitest, Vite build, Gradle/NDK build, APK launch, Android E2E, latency, xRun, CPU, RAM or thermal evidence is claimed yet.

GitHub Actions remains unusable as application evidence because attempted runs received no runner (`runner_id: 0`, empty runner name, `steps: []`).

## Runtime authority

Source-inspected Native chain:

```text
TypeScript runtime boundary
→ window.VibeCoreNative
→ NativeAudioBridge.kt
→ JNI
→ VibeCoreAudioEngine
→ Oboe callback
→ VibeCoreSync
→ AudioGraphManager
→ Groove/Bass/Voice DSP
→ output
```

Source-inspected browser sequencer chain:

```text
Zustand project state
→ browser scheduler
→ AudioContext time/lookahead
→ triggerPart
→ voice allocation
→ renderer
→ part/FX/master WebAudio graph
```

Native and browser remain separate runtime selections. The browser scheduler is gated on the Native path. Runtime authority is materially implemented but still requires device execution proof.

## Runtime/capability implementation present

- `AudioBackend` contract exists.
- `NativeOboeBackend` implements the Native backend.
- browser still uses the existing WebAudio engine directly; there is no concrete `WebAudioBackend` adapter yet.
- Capability Registry owns side-effect-free runtime availability probes.
- Native availability is detected through `window.VibeCoreNative`.
- `MainActivity.kt` injects the Native runtime bridge.
- shared live keyboard/performance input no longer directly owns WebAudio triggering on Native.
- Native Bass performance bridge is source-correlated.
- Native Voice runtime/DSP bridge is source-correlated.
- Native 3D Synth remains explicitly unsupported until a real Native renderer exists.
- Runtime Preview keeps unsupported Native preview explicit rather than stealing Voice sample slots.
- Runtime diagnostics snapshot exists.

## Timing authority

Known timing domains are explicit:

- browser `masterClock`: 24 ticks/beat
- browser scheduler song/global counters: sixteenth-note domain
- Native `VibeCoreSync`: PPQ 1920, 480 ticks/sixteenth

Conversions are centralized in runtime timing helpers. Generic cross-domain untyped `tick` interchange remains forbidden.

Native musical scheduling is callback/sample-position driven. Browser musical scheduling uses `AudioContext.currentTime`; browser timers wake the scheduler but are not the musical clock.

## Sample/Synth v13 authority

Canonical v4 ownership:

- kick/snare/perc/hat/sample → `sample-domain`
- synth → `synth3d`
- bass → `bass3d`
- `hybrid` → compatibility metadata only

Implemented modules include:

- `src/lib/instruments/sourceBoundary.ts`
- `src/lib/instruments/projectMigration.ts`
- `src/lib/instruments/sourcePolicy.ts`
- `src/lib/instruments/sourceUiPolicy.ts`
- `src/lib/instruments/runtimeSourcePlan.ts`
- `src/lib/instruments/sourceRuntimeGuard.ts`

Current behavior:

- live Zustand state is canonicalized before first React render.
- persist middleware is promoted at runtime to schema **13** with the v13 migration function.
- incompatible legacy source values are retained under `legacyInstrument.source`.
- incompatible legacy Synth-engine values are retained under `legacyInstrument.engine`.
- future `setPartSource()` writes are guarded.
- future `setSynthEngine()` writes are guarded.
- rejected legacy writes emit a visible `SourceBoundaryNotice` rather than silently becoming active authority.
- Synth-category parts are canonicalized to `source: synth`, `engine: 3D`.
- Bass-category parts are canonicalized to `source: synth`, `engine: 3D Bass`.
- Web `engine.ts` already routes those engine selectors to `trigger3DSynth` / `trigger3DBass`.
- live performance resolution uses category/runtime authority rather than a legacy engine string.

Still intentionally local-follow-up:

- `SmplTab.tsx` must be migrated to the new sample asset runtime service with compiler feedback.
- legacy SoundTab presentation still exists as compatibility UI, although its writes are now guarded and explained.
- `engine.ts` still contains legacy fallback branches for compatibility; canonical v13 state selects the 3D renderer paths for Synth/Bass.

## Native Groove project mirror

Current-scene Store → Native Groove mapping exists for:

- track mode
- mute/solo/volume
- pattern length
- swing conversion
- step active/velocity/note
- probability
- accent
- ratchet conversion
- microtiming conversion
- piano-roll notes
- sample assignment when Native registration is proven

ProjectMirror intentionally remains current-scene v1; full Pattern/Scene-bank bulk load is deferred.

## Native Groove sample asset contract

The previous sample-ID gap has been materially implemented.

Stable v1 rule:

```text
Native Groove sampleId = Part.id
```

only for Sample-domain parts and only inside Native `kMaxSamples` bounds.

Implemented path:

```text
encoded File
→ OfflineAudioContext decode on Native
→ deterministic mono Float32 PCM
→ window.VibeCoreGrooveAssets
→ NativeGrooveAssetBridge.kt
→ JNI using the existing engine()/groove() singleton context
→ GrooveEngine-owned PCM storage
→ SampleBuffer view
→ Groove VoicePool
```

Important properties:

- `VibeCoreGrooveAssets` is asset ingress only; it cannot control transport/DSP.
- browsing/decoding a sample is separate from assigning it to a Part.
- session registration truth is recorded only after Native confirms both `loadSample()` and `sampleLoaded()`.
- ProjectMirror sets the track sample ID only for confirmed registrations.
- missing/unregistered assets cause ProjectMirror to write `-1`, preventing stale sample reuse.
- PCM load/clear is currently **cold-load only**.
- Native JNI rejects sample load/clear while the Oboe engine is running.
- `activateNativeAudio()` checks assigned Sample-domain asset readiness before `startEngine()`.
- a project that references Sample-domain assets cannot silently start Native with those tracks missing PCM.
- empty Sample-domain slots do not block startup.

Detailed contract:

`docs/NATIVE_GROOVE_ASSET_CONTRACT.md`

## Sample-rate fix

Native Groove `VoicePool` now incorporates:

```text
source sample rate / output sample rate
× MIDI pitch ratio
```

into its Q16 read step.

This fixes the source-level error where e.g. a 44.1 kHz sample on a 48 kHz output stream would otherwise play at the wrong speed/pitch.

Device execution proof remains required.

## Sample asset decode/runtime boundary

New modules:

- `src/lib/audio/assetDecode.ts`
- `src/lib/audio/sampleAssetRuntime.ts`

On Native, sample decode uses `OfflineAudioContext`, not `ensureAudio()`. This prevents constructing the audible WebAudio renderer merely to obtain PCM for Native Groove.

`sampleAssetRuntime.ts` separates:

```text
decodeSampleAsset(file)
```

from:

```text
assignSampleAssetToPart(part, asset)
```

so browsing a library item does not mutate Native sample state.

The large Sample Forge UI still needs to adopt this boundary locally; exact instructions are in the Codex handover.

## Parameter authority

`src/lib/parameters/hub.ts` is the canonical ParameterHub core and owns no duplicate state. Current coverage includes:

- transport BPM
- master volume
- per-part volume
- per-part pan

TopBar and ChannelStrip migrated callers exist. Full ParameterHub adoption/undo/automation gesture design remains partial.

## AI Intent

The branch contains validated AI Intent v1 for ParameterHub-backed Mix volume/pan:

```text
Suggestion
→ Intent
→ Validation
→ Preview
→ ParameterHub command
→ Apply receipt
→ Revert / Explain
```

Additional AI mutations remain blocked until explicit command adapters exist.

## Cache architecture

Implemented cores:

- byte-budgeted/refcounted generic resource cache
- AudioBuffer cache adapter
- versioned Analysis Cache
- waveform min/max peak pyramid cache

The monolithic WebAudio engine still owns its historical unbounded maps. Integrating the budgeted cache there is deliberately deferred until complete local compile/test verification is available.

## Known intentionally open architecture items

- Native 3D Synth renderer — `UNSUPPORTED / GAP`
- Native arbitrary sample-region Preview renderer — `UNSUPPORTED / GAP`
- full Native Pattern/Scene-bank bulk load — `PARTIAL`
- Native Groove hot sample swap / epoch reclamation — `DEFERRED`
- concrete browser `WebAudioBackend` adapter symmetry — `PARTIAL`
- complete ParameterHub adoption — `PARTIAL`
- Motion Step Recorder full end-to-end contract — `PARTIAL / UNKNOWN`
- bRAINWAVEz/granular/spatial Native renderer ownership — `PARTIAL / UNKNOWN`
- Remix live input/device capture — `PARTIAL / UNKNOWN`
- Voice browser/native semantic parity — `PARTIAL / UNKNOWN`
- bounded cache adoption in legacy WebAudio engine — `PARTIAL`

## Performance truth

No performance values are claimed before measurement.

- CPU — `UNKNOWN`
- RAM — `UNKNOWN`
- XRuns — `UNKNOWN`
- Jitter — `UNKNOWN`
- latency — `UNKNOWN`
- callback budget — `UNKNOWN`
- thermal behavior — `UNKNOWN`
- UI frame pacing — `UNKNOWN`

## Local verification handover

Canonical local continuation document:

`docs/HANDOVER_CODEX_LOCAL_2026-09-16.md`

The handover contains:

- real npm scripts from `package.json`
- Native Gradle command from `native-android/README.md`
- exact Sample Forge migration patch
- Native asset E2E scenarios
- typed-array bridge verification
- sample-rate verification
- evidence write-back rules

## Required local gate order

From `G:\Dev\VibeCoreLiv3`:

```powershell
npm ci
npm run typecheck
npm run lint
npm test
npm run build
npm run build:android
```

Then:

```powershell
cd G:\Dev\VibeCoreLiv3\native-android
.\gradlew.bat :app:assembleDebug
```

After build success, run Android device E2E before changing PR #1 from Draft.

## Release rule

Do not call VibeCore v4 `COMPLETE`, `VERIFIED` or production-ready until applicable v4.0 Definition-of-Done gates have been executed and evidence recorded.

Current release statement:

**Runtime, Sample/Synth authority and Native Groove cold asset hydration are materially implemented on the revision branch. The branch is ready for local compile/test/device verification, but is not yet release-verified.**
