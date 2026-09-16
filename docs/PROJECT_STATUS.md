# VibeCoreLiv3 — Project Status

Stand: 2026-09-16  
Branch: `revision/v4-runtime-consolidation`

## Canonical engineering source

The normative engineering specification is:

`docs/VibeCore_Univers_SUPREME_MasterPrompt_UNIFIED_v4.0.md`

Older prompts, handovers, statistics and validation reports are historical or supporting material unless explicitly marked otherwise.

## Current phase

**RUNTIME CONSOLIDATION & UX PERFORMANCE REVISION**

The project is no longer treated as a UI prototype. It contains a substantial React/Vite application, musical domain/state model, Android WebView/native bridge path and native C++/Oboe audio platform. Current work is consolidation, contract alignment, performance work and verification rather than broad feature expansion.

## Runtime authority status

The original runtime call-graph stop-gate has progressed materially. The branch now contains explicit frontend runtime boundaries and source-correlated Native paths rather than only an architectural target.

Source-inspected chains include:

`TypeScript → Native runtime/bridge → Kotlin → JNI → C++ engine → Oboe callback → graph/DSP → output`

and browser performance paths through the existing WebAudio engine/voice allocators.

This remains `STATICALLY VERIFIED`, not executed device proof.

## Implemented / source-proven in the revision branch

Status terminology follows the v4.0 MasterPrompt.

- `AudioBackend` interface exists — `STATICALLY VERIFIED`
- `NativeOboeBackend implements AudioBackend` — `STATICALLY VERIFIED`
- no concrete `WebAudioBackend implements AudioBackend` exists; browser fallback uses `engine.ts` directly — `STATICALLY VERIFIED`
- `nativeAudioRuntime.ts` binds backend tempo/gain/transport/seek state and delegates Native availability to Capability Registry — `STATICALLY VERIFIED`
- Android `MainActivity.kt` injects `NativeAudioBridge` as `window.VibeCoreNative` — `STATICALLY VERIFIED`
- Kotlin → JNI → C++ lifecycle/transport/Groove/Bass/Voice mappings exist for inspected paths — `STATICALLY VERIFIED`
- `VibeCoreAudioEngine::onAudioReady()` is the inspected Oboe callback — `STATICALLY VERIFIED`
- native Groove step path reaches `StepSequencer → TriggerQueue → GrooveNode → voice targets` — `STATICALLY VERIFIED`
- browser scheduler reaches `scheduleTickAt() → triggerPart() → voice allocation → WebAudio graph` — `STATICALLY VERIFIED`
- central Zustand application/project state exists — `STATICALLY VERIFIED`
- Capability Registry exists and owns side-effect-free runtime availability probes — `STATICALLY VERIFIED`
- runtime selection delegates Native/Web availability to Capability Registry — `STATICALLY VERIFIED`
- shared `InstrumentKeyboard` routes through Runtime PerformanceInput instead of direct WebAudio calls — `STATICALLY VERIFIED`
- Browser 3D Synth/Bass note registration acknowledgement is wired through the existing voice engines — `STATICALLY VERIFIED`
- Native Bass noteOn/noteOff/allNotesOff bridge is source-correlated — `STATICALLY VERIFIED`
- Native 3D Synth is explicitly capability-gated unavailable until a renderer exists — `STATICALLY VERIFIED GAP`
- Runtime Preview boundary exists; Native preview is explicitly unsupported rather than stealing a Voice sample slot — `STATICALLY VERIFIED`
- Runtime Voice boundary exists for source-correlated Native Voice DSP/live-input controls — `STATICALLY VERIFIED`
- canonical `ParameterHub` exists at `src/lib/parameters/hub.ts` as a stateless proxy over the existing store — `STATICALLY VERIFIED`
- TopBar BPM, Tap Tempo and Master Volume now write through the canonical ParameterHub — `STATICALLY VERIFIED`
- ChannelStrip Part Volume/Pan now write through ParameterHub — `STATICALLY VERIFIED`
- unified Runtime diagnostics snapshot exists — `STATICALLY VERIFIED`
- deterministic byte-budgeted/refcounted ResourceCache exists — `STATICALLY VERIFIED CORE`
- AudioBuffer cache adapter exists — `STATICALLY VERIFIED CORE`
- versioned Analysis Cache exists — `STATICALLY VERIFIED CORE`
- Waveform min/max peak pyramid cache exists — `STATICALLY VERIFIED CORE`
- AI learning consent/profile implementation exists — `STATICALLY VERIFIED`
- AI Intent v1 exists for parameter-backed Mix volume/pan with validation, pure preview, apply, receipt-based revert and explain — `STATICALLY VERIFIED CORE`
- current-Scene Store → Native Groove hydration runs after successful Native engine activation and reports mirror diagnostics separately from audio activation — `STATICALLY VERIFIED`
- Sample/Synth ownership contract, v13 migration core, new-write policy, UI policy and runtime-source plan exist — `STATICALLY VERIFIED CORE`
- live canonical Source Guard is bound before Native/clock/scheduler/parameter startup and re-canonicalizes recognized legacy Part source writes inside the existing Zustand authority — `STATICALLY VERIFIED`
- Runtime diagnostics report canonical/invalid/legacy instrument source counts — `STATICALLY VERIFIED`
- dedicated Synth3D and Bass3D pages no longer write the legacy `Part.source` switch when selecting their engines — `STATICALLY VERIFIED`
- E2E simulation matrix exists — `STATICALLY VERIFIED`

## Runtime capability authority

Migrated Runtime paths now use the central Capability Registry for availability instead of inventing local environment rules.

Covered probe families include:

- Web/Native audio
- Native low-latency path presence
- Web input API presence
- Browser/Native preview
- Browser/Native 3D Synth
- Browser/Native 3D Bass
- Native Voice/live input
- Web MIDI API presence
- IndexedDB presence

Runtime probes do not initialize audio, request permissions, open MIDI or create a renderer. Availability is not equivalent to executed verification.

## Parameter authority

`src/lib/parameters/hub.ts` is the single canonical ParameterHub implementation in the branch.

Version 1 deliberately owns **no second parameter state**. It proxies the canonical Zustand store and currently covers:

- `transport.bpm`
- `master.volume`
- `part.<id>.volume`
- `part.<id>.pan`

The Hub also owns range/unit/persistence/realtime descriptors and selective subscriptions. Gesture hooks remain stateless no-ops until one authoritative undo/automation batching model is selected.

A transient duplicate implementation created during consolidation was detected by the branch diff and removed before verification; no second ParameterHub implementation remains intentionally.

## AI Intent authority

`src/lib/ai/intent.ts` provides the first validated v4-style flow:

```text
Suggestion
→ Intent
→ Validation
→ Preview (no mutation)
→ ParameterHub command
→ Apply receipt
→ Revert
→ Explain
```

Version 1 deliberately supports only Mix `volume` and `pan` suggestions because those parameters already have canonical persisted ParameterHub routes. FX/master and other suggestion kinds remain rejected until explicit command adapters exist.

No hidden global AI history/store is created; apply receipts are caller-owned.

## Sample/Synth ownership authority

The old v12 model still contains legacy `SourceMode = sample | synth | hybrid` and old helpers/UI that expose those modes too broadly. The revision branch now contains explicit v4 ownership modules:

- `src/lib/instruments/sourceBoundary.ts`
- `src/lib/instruments/projectMigration.ts`
- `src/lib/instruments/sourcePolicy.ts`
- `src/lib/instruments/sourceUiPolicy.ts`
- `src/lib/instruments/runtimeSourcePlan.ts`
- `src/lib/instruments/sourceRuntimeGuard.ts`

Canonical ownership is:

- kick/snare/perc/hat/sample → `sample-domain`
- synth → `synth3d`
- bass → `bass3d`
- `hybrid` → compatibility data only, not a valid new runtime source

The migration core preserves incompatible v12 source values under `legacyInstrument.source` instead of silently discarding them. The live Source Guard is now bound before audio/clock/scheduler startup, canonicalizes the authoritative Zustand `parts` state on application startup, and immediately repairs later recognized legacy source writes. It does not create a second state store.

The dedicated Synth3D and Bass3D pages have also been decoupled from `setPartSource(..., "synth")`; engine ownership now stands on its own in those pages.

Still partial:

- the Zustand persist declaration itself still says schema v12 rather than v13
- `buildDefaultParts()` still contains legacy source defaults before the live guard runs
- `SoundTab` still exposes the three-way legacy Source Mode UI
- WebAudio `engine.ts` still contains the legacy audible `part.source` sample/synth/hybrid branch

See `docs/SAMPLE_SYNTH_MIGRATION_CONTRACT.md`.

## Important remaining runtime-contract findings

### Backend asymmetry

`AudioBackend.ts` describes WebAudio and native as backend concepts, but only `NativeOboeBackend` implements the interface. Browser operation still uses direct `engine.ts` runtime code instead of a concrete `WebAudioBackend` adapter.

This is an architecture asymmetry, not authorization to build a second browser engine.

### Native Groove project mirroring remains partial

Current-scene Store→Native mapping and automatic post-activation hydration now exist, with explicit timing conversions and separate mirror diagnostics.

Still unresolved:

- full Pattern/Scene-bank bulk loading
- stable Web asset → Native sample-ID mapping
- Kotlin/JNI marshalling for the C++ project-load undo-suppression guard (`beginProjectLoad/endProjectLoad`)

The absence of those pieces means ProjectMirror is useful but not yet a full project-bank contract.

### Timing domains remain explicit

At least three timing units exist:

- Browser `masterClock.tick`: 24 ticks per beat
- Browser scheduler `globalTick/songTicks`: sixteenth-note counters
- Native `VibeCoreSync`: PPQ 1920 / 480 ticks per sixteenth

They may coexist only through explicit conversion/domain ownership. Generic untyped `tick` interchange remains unsafe.

### Voice UI semantics are not yet equivalent to Native Voice DSP

The Native Voice engine has real pitch/formant/monitor/dry-wet/live-input/DSP controls. Existing `VoiceTab` still primarily edits generic Part state.

Notable mismatch examples:

- UI `FORMANT` is not the dedicated Native Voice formant control
- generic recording state is not proof Native Voice input opened
- generic Part sends/drive are not equivalent to Native Voice DSP controls

Migration must keep those semantics distinct.

### WebAudio sample cache is still unbounded

The existing WebAudio engine still owns an unbounded `Map<SampleId, AudioBuffer>`.

The new budgeted cache core is present but not yet connected to the ~77 KB engine module. This integration is intentionally deferred until it can be done with complete-file/build verification instead of a risky blind monolithic replacement.

## Known architecture gaps / conflicts

- Native 3D Synth renderer — `UNSUPPORTED / GAP`
- Native Preview buffer/region renderer — `UNSUPPORTED / GAP`
- Native Groove full ProjectMirror/bulk-load/sample-asset contract — `PARTIAL`
- full ParameterHub coverage and gesture/undo/automation integration — `PARTIAL`
- Sample/Synth store/UI/runtime adoption — `PARTIAL`; live guard and dedicated-page decoupling implemented, legacy store declaration/SoundTab/engine branch remain
- AI Intent adapters beyond Mix volume/pan — `PARTIAL`
- Runtime backend access is not yet uniformly represented by one frontend backend interface — `PARTIAL`
- Motion Step Recorder end-to-end contract — `PARTIAL / UNKNOWN`
- bRAINWAVEz/granular/spatial Native audible-render ownership — `PARTIAL / UNKNOWN`
- Remix live audio input / device playback capture — `PARTIAL / UNKNOWN`
- Voice browser DSP parity — `PARTIAL / UNKNOWN`
- cache-core integration into real asset/analysis callers — `PARTIAL`

## Performance truth

No performance values are claimed before measurement.

- CPU — `UNKNOWN`
- RAM — `UNKNOWN`
- XRuns — `UNKNOWN`
- Jitter — `UNKNOWN`
- Latency — `UNKNOWN`
- Callback budget — `UNKNOWN`
- thermal behavior — `UNKNOWN`
- UI frame pacing — `UNKNOWN`

Configured target values and transient UI-reported counters are not benchmark evidence.

## Verification status

The presence of scripts, test files, workflows or test plans is not proof of successful execution.

A local clean-worktree verification attempt was blocked before checkout because the execution shell could not resolve `github.com`.

A GitHub Actions verification workflow now exists and attempted run `35060578966` / job `104679844962`, but GitHub assigned no runner (`runner_id: 0`, empty runner name) and recorded `steps: []`. No `npm ci`, TypeScript, lint, Vitest or Vite command ran. This is a runner/workflow-start blocker, not application build-failure evidence.

Therefore these application gates remain `NOT EXECUTED`:

- typecheck
- lint
- unit tests
- web build
- Android web build
- native/Gradle build
- APK install and launch
- live Android E2E matrix
- Browser rapid-key test
- Native Bass keyboard test
- Native Voice live-input test
- audio latency/xRun measurements
- CPU/RAM/thermal profiling
- UI frame-pacing profiling
- reference-audio/DSP quality verification

See `docs/TEST_STATUS.md` for the verification ledger.

## Revision order from current branch state

1. Runtime/capability authority consolidation — **materially implemented / still expanding adoption**
2. Sample/Synth v13 store/UI/runtime adoption — **live guard active; legacy store declaration/SoundTab/engine branch remain**
3. Native Groove ProjectMirror bulk-load/sample-asset completion
4. ParameterHub adoption and command-history design
5. AI Intent caller migration / additional validated command adapters
6. Cache integration into real asset/analysis callers
7. Voice UI semantic migration
8. Native 3D Synth renderer design/implementation
9. remaining Native audible-render ownership gaps
10. Motion Recorder consolidation
11. Remix live-input path
12. full typecheck/build/APK/device/performance verification

## Release rule

Do not call the project `COMPLETE`, `VERIFIED` or production-ready until the applicable v4.0 Definition of Done and executed verification gates are satisfied.

Current release statement:

**The revision branch contains substantial Runtime consolidation and stronger contracts, but VibeCore v4.0 is not yet release-verified.**
