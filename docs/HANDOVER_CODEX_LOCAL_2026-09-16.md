# VibeCoreLiv3 — Local Codex Handover

Date: 2026-09-16  
Branch: `revision/v4-runtime-consolidation`  
Base main: `308ae3849ca5bbce9142252f660e4bc2bc870672`  
PR: #1 (draft, do not merge before local verification)

## Mission

Take the current remote revision branch and finish **local verification + compile-driven integration only**.

Do **not** redesign runtime authority, add another scheduler, add another audio renderer, create a second project store, or merge to `main` until all applicable local gates below pass.

The remote branch already contains the architecture decisions and most runtime implementation. Local Codex should treat the source as authoritative and use compiler/test/device evidence to fix integration defects.

---

## 1. What is already implemented remotely

### Runtime authority

- Native runtime selection/capability boundary.
- Browser scheduler is gated away from the Native path.
- shared live keyboard/performance input routes through runtime boundaries rather than directly owning WebAudio.
- Runtime timing conversions are explicit between browser sixteenth counters and Native PPQ 1920.
- Native project current-scene mirror exists.
- Runtime diagnostics snapshot exists.

### Sample/Synth authority v13

- canonical ownership:
  - kick/snare/perc/hat/sample → Sample domain
  - synth → 3D Synth
  - bass → 3D Bass
  - hybrid → legacy compatibility only
- reversible legacy metadata under `legacyInstrument`.
- persist contract promoted to schema 13 through the live compatibility guard.
- Source writes and Synth-engine writes are guarded at the Zustand action boundary.
- Source guard binds before first React render.
- Synth/Bass migration promotes renderer engines to `3D` / `3D Bass`.
- legacy rejected Source/Engine requests are surfaced through `SourceBoundaryNotice`.
- live performance resolver follows `runtimeSourcePlan`.

### Native Groove sample asset contract

Files of interest:

- `src/lib/audio/assetDecode.ts`
- `src/lib/audio/sampleAssetRuntime.ts`
- `src/lib/runtime/nativeGrooveAssets.ts`
- `src/lib/runtime/projectMirror.ts`
- `native-android/app/src/main/java/com/vibecore/audio/NativeGrooveAssetBridge.kt`
- `native-android/app/src/main/cpp/groove/GrooveEngine.{h,cpp}`
- `native-android/app/src/main/cpp/bridge/jni_bridge.cpp`

Implemented contract:

```text
Project Part.id
  → deterministic Native sampleId
  → renderer-independent OfflineAudioContext decode
  → mono Float32 PCM
  → window.VibeCoreGrooveAssets
  → NativeGrooveAssetBridge.kt
  → JNI (same engine()/groove() singletons)
  → GrooveEngine-owned PCM storage
  → SampleBuffer view
  → Groove VoicePool
```

Important guarantees:

- `VibeCoreGrooveAssets` is **asset ingress only**, not a second runtime/audio authority.
- sample ID v1 is `part.id` for Sample-domain parts.
- ProjectMirror sets a sample ID only when the session registry proves Native acknowledged that PCM.
- otherwise ProjectMirror explicitly sets `-1`, preventing stale sample reuse.
- PCM load/clear is **cold-load only**; JNI rejects it while the Oboe engine stream is running.
- `activateNativeAudio()` now checks project asset readiness **before** `startEngine()`.
- a project with assigned Sample-domain metadata cannot start Native with silently missing PCM.
- library decode and Part assignment are separate operations (`decodeSampleAsset()` vs `assignSampleAssetToPart()`).
- Native decode does not call `ensureAudio()` and therefore does not create the audible WebAudio graph merely to obtain PCM.

### Native sample-rate correctness

`Groove VoicePool` now includes source/output sample-rate ratio in the playback step in addition to MIDI pitch ratio. This prevents 44.1 kHz assets from playing at the wrong pitch/speed on a 48 kHz stream.

---

## 2. Hard rules for Codex

1. Keep `main` untouched. Work on `revision/v4-runtime-consolidation` or a child fix branch.
2. Do not merge PR #1 until local verification is recorded.
3. Do not invent successful tests. Record command + exit code + failure text.
4. Do not reintroduce direct WebAudio live triggers on Native.
5. Do not let Sample Forge call `ensureAudio()` merely for decode/assignment on Native.
6. Do not bypass `nativeGrooveAssetRegistry` by calling `grooveSetTrackSample()` directly from UI.
7. Do not use the Voice sample slots as a shortcut for Groove assets.
8. Do not implement Native hot sample swap by freeing/replacing PCM pointers while the stream runs. Cold-load is the current contract. Hot-swap needs explicit epoch/deferred reclamation similar to VoiceEngine.
9. Do not change v4 Sample/Synth ownership back to the old three-way mutable Source model.
10. Any architecture change requires an ADR/update to the existing v4 docs.

---

## 3. First local verification pass

From repository root on Windows:

```powershell
cd G:\Dev\VibeCoreLiv3
git status
git branch --show-current
git pull
npm ci
npm run typecheck
npm run lint
npm test
npm run build
npm run build:android
```

Expected branch:

```text
revision/v4-runtime-consolidation
```

Do not skip failures. Fix in this priority:

1. TypeScript/compile errors introduced by revision files.
2. Vitest contract failures.
3. ESLint violations.
4. Vite browser build.
5. Vite Android build.

Re-run the complete set after each fix cluster.

---

## 4. Native Android build

Repository already documents the native build command.

```powershell
cd G:\Dev\VibeCoreLiv3\native-android
.\gradlew.bat :app:assembleDebug
```

If using Git Bash/Linux equivalent:

```bash
./gradlew :app:assembleDebug
```

Native compile blockers have priority over feature work.

Specifically verify JNI signatures for:

```text
NativeGrooveAssetBridge.nativeCanLoad
NativeGrooveAssetBridge.nativeLoadSample
NativeGrooveAssetBridge.nativeClearSample
NativeGrooveAssetBridge.nativeSampleLoaded
```

Also verify `GrooveEngine::loadSample`, `clearSample`, `sampleLoaded` declarations/definitions match exactly.

---

## 5. Required Sample Forge integration patch

The large `src/components/groovebox/SmplTab.tsx` was intentionally **not blindly replaced remotely**. Perform this patch locally with compiler feedback.

### A. Imports

Use:

```ts
import {
  decodeSampleAsset,
  assignSampleAssetToPart,
  type DecodedSampleAsset,
} from "@/lib/audio/sampleAssetRuntime";
import { isNativeAudioPath } from "@/lib/audio/nativeAudioRuntime";
```

Do not use `decodeSampleFile()` directly from Sample Forge after this migration.

### B. Library model

Extend the local library entry so it retains the decoded asset, not only its AudioBuffer:

```ts
interface LoadedSample {
  name: string;
  buffer: AudioBuffer;
  asset: DecodedSampleAsset;
  dur: string;
}
```

### C. File load

Replace the current unconditional:

```ts
await ensureAudio();
const buf = await decodeSampleFile(f);
```

with:

```ts
const asset = await decodeSampleAsset(f);
const buf = asset.buffer;
```

and store `asset` in the library entry.

Result: Native library decode must not create the audible WebAudio graph.

### D. Assign to selected Part

Replace unconditional `await ensureAudio(); assignBufferToPart(...)` with:

```ts
const result = assignSampleAssetToPart(part, sample.asset);
if (!result.assigned) {
  setStatus(result.nativeUpload?.reason ?? "Sample assignment failed");
  return;
}
setPartSampleName(selectedPart, sample.name);
setWaveEdit(selectedPart, { start: 0, end: 1 });
```

Native assignment now means: PCM upload acknowledgement first, then editor buffer retention, then project metadata.

### E. Preview and destructive edits

On Native, do **not** call `ensureAudio()` for preview or edit rendering simply to get an audible browser graph.

For this local pass:

- browser path may retain existing WebAudio preview behavior;
- Native preview may remain explicitly unsupported using the existing Runtime Preview boundary;
- normalize/reverse/trim/fade/pitch/stretch/freeze may operate on the editor `AudioBuffer`, but after changing an **assigned Native** Sample-domain asset the resulting PCM must be re-uploaded while Native engine is stopped before project metadata is treated as ready;
- if stream is running, surface a clear "Stop Native audio before replacing sample" result rather than silently starting WebAudio.

Do not implement unsafe Native hot-swap in this pass.

---

## 6. Asset readiness scenarios to verify locally

### Scenario A — Empty project

- no Sample-domain `sampleName`
- `nativeGrooveAssetReadiness(...).ready === true`
- Native can start.

### Scenario B — Project metadata references a sample but PCM is not loaded

- set/restore Sample-domain `sampleName`
- registry has no acknowledgement
- Native start must fail cleanly before Oboe starts
- error must identify missing part name(s)
- no WebAudio fallback should start automatically.

### Scenario C — Cold-load sample

1. Native engine stopped.
2. Decode file through `decodeSampleAsset()`.
3. Assign through `assignSampleAssetToPart()`.
4. Verify `VibeCoreGrooveAssets.loadSample()` returns true.
5. Verify `sampleLoaded(sampleId)` true.
6. Verify registry contains `part.id`.
7. Start Native.
8. ProjectMirror should set the track's sample ID to `part.id`.
9. Trigger Groove step and verify audible output.

### Scenario D — Running-engine replacement

- with Native stream running, try assigning replacement PCM.
- bridge must reject cold-load.
- registry/current Native PCM must remain coherent.
- UI must explain that Native must be stopped before replacement.

### Scenario E — Sample-rate mismatch

Test at least one 44.1 kHz source on a 48 kHz stream.

Expected:

- no pitch/speed shift caused merely by sample-rate mismatch.
- musical Step.pitch should still transpose independently.

---

## 7. Android device E2E

After a successful APK build/install, verify at minimum:

1. WebView exposes `window.VibeCoreNative`.
2. WebView exposes `window.VibeCoreGrooveAssets`.
3. `VibeCoreGrooveAssets.canLoad()` is true before engine start.
4. Typed-array contract works end-to-end (`Float32Array → Kotlin FloatArray → JNI jfloatArray`).
5. `loadSample()` returns true for a valid mono PCM payload.
6. `sampleLoaded()` returns true.
7. `canLoad()` becomes false while Oboe engine is running.
8. Native ProjectMirror reports expected `assignedSamples` and zero missing registered samples for hydrated Sample-domain parts.
9. No WebAudio scheduler/renderer starts in parallel during Native playback.
10. Stop/Play transport does not erase sample registration because the engine object remains alive.

Record device model, Android version, sample rate, burst size, latency report and any XRuns. Do not convert these into global performance claims from one device.

---

## 8. Existing automated tests most relevant to this handover

Run the full suite, but pay special attention to:

```text
src/lib/audio/__tests__/assetDecode.test.ts
src/lib/runtime/__tests__/nativeGrooveAssets.test.ts
src/lib/runtime/__tests__/projectMirror.test.ts
src/lib/instruments/__tests__/projectMigration.test.ts
src/lib/instruments/__tests__/sourceRuntimeGuard.test.ts
src/lib/runtime/__tests__/performanceInput.test.ts
src/lib/runtime/__tests__/timing.test.ts
```

Tests existing in source are **not** considered passed until executed locally.

---

## 9. Known intentionally deferred items

Do not expand scope while verifying this slice.

Deferred after this local pass:

- Native Groove hot sample replacement with epoch/deferred reclamation.
- full Pattern/Scene-bank Native bulk load.
- Native 3D Synth renderer.
- Native arbitrary preview renderer.
- full browser `WebAudioBackend` adapter symmetry.
- complete ParameterHub adoption.
- bounded cache integration into the monolithic WebAudio engine.
- broad Voice UI semantic migration.
- performance tuning before measurements exist.

---

## 10. Evidence to write back after local work

Update these documents with **actual results**:

```text
docs/TEST_STATUS.md
docs/PROJECT_STATUS.md
docs/NATIVE_GROOVE_ASSET_CONTRACT.md
docs/REVISION_WORKLOG.md
```

For every gate record:

```text
command
exit code
PASS / FAIL / BLOCKED
relevant error text
commit SHA tested
machine/device context where relevant
```

If all web + native builds/tests pass, then perform Android device E2E. Only after that should PR #1 be considered for non-draft/merge review.

---

## 11. Definition of local handover completion

Codex may call this handover locally complete when all of the following are true:

- `npm run typecheck` PASS
- `npm run lint` PASS
- `npm test` PASS
- `npm run build` PASS
- `npm run build:android` PASS
- `native-android .\gradlew.bat :app:assembleDebug` PASS
- Sample Forge no longer creates WebAudio on Native merely to decode/assign PCM
- Native asset cold-load typed-array bridge proven on device
- project asset-readiness gate proven
- 44.1 → 48 kHz playback ratio verified audibly/technically
- evidence written back to docs

Until those gates execute, status remains **STATICALLY VERIFIED / NOT EXECUTED**, not release-verified.
