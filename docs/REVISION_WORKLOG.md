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
- freshly confirmed the v12 persistence migration returns v12+ state unchanged and therefore does not repair legacy ownership by itself
- freshly confirmed `SoundTab` still exposes interactive `sample` / `synth` / `hybrid` source switching and a Hybrid editor
- freshly confirmed WebAudio `engine.ts` still selects the audible renderer from mutable `part.source`, including a legacy Hybrid/Sub branch
- added `src/lib/instruments/sourceBoundary.ts` as the canonical ownership contract
- added `src/lib/instruments/projectMigration.ts` with pure, reversible v12 → v13 project migration
- added `src/lib/instruments/sourcePolicy.ts` for canonical new/default state and new source writes
- added `src/lib/instruments/sourceUiPolicy.ts` so new v4 UI exposes one authority per Part category
- added `src/lib/instruments/runtimeSourcePlan.ts` so target audible-render ownership is category/authority-driven rather than `Part.source`-driven
- added `src/lib/instruments/sourceRuntimeGuard.ts` as a compatibility bridge over the single authoritative Zustand store
- bound the canonical source guard before Native/clock/scheduler/parameter runtime bindings in `src/pages/Index.tsx`
- live startup now canonicalizes recognized legacy Part sources and preserves incompatible original values under `legacyInstrument.source`
- future legacy source writes are immediately re-canonicalized by the same guard instead of becoming a second audible authority
- Runtime diagnostics now report total/canonical/invalid-active/legacy-compatibility Part source counts
- removed redundant `setPartSource(..., "synth")` coupling from both dedicated `Synth3DPage` and `Bass3DPage`
- canonical ownership resolves drum/sample categories to `sample-domain`, synth to `synth3d`, and bass to `bass3d`
- `hybrid` is compatibility data only; no new v4 authority contract re-enables it
- added source-level tests for boundary, project migration, write policy, UI policy, runtime render planning and runtime guard/idempotence
- direct store persist schema remains declared as v12 and `SoundTab`/`engine.ts` still contain legacy UI/render branches; those mechanical migrations remain partial

### Verification infrastructure

- added `.github/workflows/revision-verify.yml` with `npm ci`, typecheck, lint, unit tests, web build and Android web bundle gates
- first observed PR run `35060578966` created job `104679844962` but GitHub assigned no runner (`runner_id: 0`, empty runner name, `steps: []`)
- no npm command executed in that run; this is recorded as a runner/workflow-start blocker rather than an application build failure
- local clean-worktree verification is separately blocked because the execution shell cannot resolve `github.com`

### Current

Runtime consolidation continues with three main open implementation fronts:

1. complete the remaining Sample/Synth mechanical migration in store persistence metadata, `SoundTab` and WebAudio renderer routing
2. complete Native ProjectMirror bulk-load/sample-asset contract
3. continue safe ParameterHub/AI Intent caller adoption and obtain an executable verification environment

### Verification

No build/runtime claim has been upgraded to `VERIFIED` in this revision cycle.

Still `NOT EXECUTED` at application-command level:

- TypeScript typecheck
- lint
- unit-test suite
- web build
- Android web build
- Gradle/native build
- APK install/launch
- Android E2E
- latency/xRun/jitter/CPU/RAM/thermal measurements

The GitHub Actions verification attempt is `BLOCKED` before the first workflow step because no runner was allocated. Source inspection and test-file presence remain static evidence only.
