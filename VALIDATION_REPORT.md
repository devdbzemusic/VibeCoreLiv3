# VibeCoreLiv3 — Validation Report

Generated: 2026-08-01T01:12:05.122Z

## Checks

| Check | Status | Detail |
| --- | --- | --- |
| Project structure captured | PASS | 355 files |
| Duplicate filenames | WARN | 12 duplicates |
| Missing import references | WARN | 1 unresolved |
| node_modules excluded | PASS | by glob |
| Build/dist excluded | PASS | by glob |
| .git object data | SKIP | not reachable client-side — noted in MISSING_FILES.md |

## Duplicate filenames

- **engine.ts**: src/lib/ai/engine.ts, src/lib/audio/engine.ts
- **index.ts**: src/lib/ai/index.ts, src/lib/bass3d/index.ts, src/lib/dsp/index.ts, src/lib/fxmixlab/index.ts, src/lib/groove/index.ts, src/lib/sampleforge/index.ts, src/lib/synth3d/index.ts, src/utils/index.ts
- **presets.ts**: src/lib/ai/presets.ts, src/lib/forge/presets.ts, src/lib/fxmixlab/presets.ts
- **selfTest.ts**: src/lib/ai/selfTest.ts, src/lib/fxmixlab/selfTest.ts
- **types.ts**: src/lib/ai/types.ts, src/lib/clock/types.ts, src/lib/forge/types.ts, src/lib/fxmixlab/types.ts
- **params.ts**: src/lib/bass3d/params.ts, src/lib/synth3d/params.ts
- **trigger.ts**: src/lib/bass3d/trigger.ts, src/lib/synth3d/trigger.ts
- **voice.ts**: src/lib/bass3d/voice.ts, src/lib/synth3d/voice.ts
- **voiceEngine.ts**: src/lib/bass3d/voiceEngine.ts, src/lib/synth3d/voiceEngine.ts
- **aiAssistant.ts**: src/lib/fxmixlab/aiAssistant.ts, src/lib/sampleforge/aiAssistant.ts
- **analysis.ts**: src/lib/groove/analysis.ts, src/lib/sampleforge/analysis.ts
- **README.md**: native-android/README.md, vibecore-platform/README.md, vibecore-platform/diagrams/README.md, README.md

## Unresolved import references

| File | Specifier |
| --- | --- |
| src/components/groovebox/GithubSyncDialog.tsx | @/lib/downloadSource |
