# VibeCoreLiv3 — Revision Worklog

## 2026-09-16 — Revision start

Branch: `revision/v4-runtime-consolidation`

### Baseline completed

- established canonical v4.0 project status
- replaced stale Base44-focused README
- documented target architecture
- added capability matrix baseline
- added explicit test/verification status
- documented known gaps
- added revision plan
- accepted ADR-0001 for Sample/Synth boundaries
- accepted ADR-0002 for Runtime Authority / call-graph truth
- opened Draft PR #1 for the revision branch

### Runtime consolidation implemented / source-inspected

- introduced explicit frontend Runtime contracts for selection, transport, timing, performance input, preview and Voice
- migrated shared InstrumentKeyboard performance input away from direct WebAudio ownership
- source-correlated Native Bass and Voice bridge paths
- kept Native 3D Synth and Native Preview explicitly unavailable until dedicated render contracts exist
- centralized runtime availability probes in Capability Registry
- migrated Native runtime selection/activation checks to Capability Registry
- added unified Runtime diagnostics snapshot
- added explicit timing-domain conversion helpers/tests

### Parameter authority

- retained one canonical ParameterHub at `src/lib/parameters/hub.ts`
- removed an accidental duplicate Runtime ParameterHub during branch reconciliation
- ParameterHub remains a stateless proxy over canonical Zustand state
- migrated TopBar BPM, Tap Tempo and Master Volume through ParameterHub
- migrated ChannelStrip Part Volume and Pan through ParameterHub
- left parameters without a finalized contract on their existing actions rather than expanding the Hub speculatively

### Native ProjectMirror

- implemented current-Pattern/current-Scene Store → Native Groove mirroring
- added explicit Web → Native conversions for swing, ratchet and microtiming
- mirrored Groove step state, track state and Piano Roll through the declared bridge surface
- connected current-scene hydration after successful Native engine startup
- made ProjectMirror failure non-fatal to audio activation and exposed separate mirror diagnostics
- added source-level ProjectMirror tests for bridge calls and unavailable-bridge behavior
- full Pattern/Scene-bank bulk load and stable Web asset → Native sample-ID mapping remain unresolved

### AI intent boundary

- implemented AI Mix Intent v1 for Volume/Pan
- flow now supports validation, side-effect-free preview, apply through ParameterHub, receipt, revert and explain
- unsupported Mix/FX payloads are rejected rather than bypassing the command boundary
- UI caller migration remains intentionally partial until a complete, safely editable caller is verified

### Cache / performance foundation

- added byte-budgeted/refcounted ResourceCache core
- added AudioBuffer cache adapter
- added versioned Analysis Cache
- added Waveform peak-pyramid cache
- added cache unit-test sources
- legacy WebAudio `engine.ts` AudioBuffer Map remains unbounded and is not yet replaced because the monolithic engine requires complete-file/build verification before safe integration

### Sample / Synth boundary

- freshly confirmed the legacy model still permits `sample`, `synth` and `hybrid` for almost every non-generic sample category
- freshly confirmed `buildDefaultParts()` initializes kick/snare/perc/hat as `source: "synth"`
- freshly confirmed the v12 persistence migration returns v12+ state unchanged and therefore does not repair legacy ownership
- added `src/lib/instruments/sourceBoundary.ts` as a pure canonical ownership contract
- canonical ownership now resolves drum/sample categories to `sample-domain`, synth to `synth3d`, and bass to `bass3d`
- `hybrid` is classified as legacy compatibility data rather than a valid new v4 runtime source
- added reversible v12 → v13 source migration semantics that preserve the original invalid source value instead of silently discarding it
- added source-level tests for ownership, invalid transitions and legacy preservation
- documented the integration contract in `docs/SAMPLE_SYNTH_MIGRATION_CONTRACT.md`
- Store/UI/runtime adoption remains pending; no large whole-file Store replacement was attempted through the connector

### Current

Runtime consolidation continues with three main open implementation fronts:

1. adopt the new Sample/Synth ownership contract in Zustand persistence/defaults/UI/runtime routing
2. complete Native ProjectMirror bulk-load/sample-asset contract
3. continue safe ParameterHub/AI Intent caller adoption

### Verification

No build/runtime claim has been upgraded to `VERIFIED` in this revision cycle.

Still `NOT EXECUTED` without concrete evidence:

- TypeScript typecheck
- lint
- unit-test suite
- web build
- Android web build
- Gradle/native build
- APK install/launch
- Android E2E
- latency/xRun/jitter/CPU/RAM/thermal measurements

Source inspection and test-file presence are recorded only as static evidence.
