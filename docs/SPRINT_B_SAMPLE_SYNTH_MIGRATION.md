# Sprint B — Sample / Synth Boundary Migration

Status: IN PROGRESS
Date: 2026-09-16

## Objective

Align the current model and UI with v4.0 Sample-Slot Integrity without silently destroying legacy project state.

## Current conflict

Legacy model:

```ts
type SourceMode = "sample" | "synth" | "hybrid";
```

Current helper behavior allows most non-generic categories to use all three source modes.

v4.0 requires sample slots to remain sample/audio contexts and synthesis to belong to 3D Synth / 3D Bass.

## Execution sequence

1. Inventory all reads/writes of:
   - `Part.source`
   - `SourceMode`
   - `allowedSourcesForCategory`
   - `normalizeSourceForCategory`
   - `canUseSynthForCategory`
   - `canUseHybridForCategory`
2. Classify callers:
   - persistence/migration
   - UI
   - runtime/audio
   - AI
   - tests
3. Introduce semantic helpers for explicit instrument ownership.
4. Add legacy normalization/migration contract.
5. Prevent new invalid source transitions in UI/state commands.
6. Migrate runtime branching.
7. Update E2E expectations.
8. Add regression tests for legacy serialized projects.

## Safety rule

Do **not** immediately delete legacy enum values from deserialization. Old projects must remain readable until migration is proven.

## Proposed semantic helpers

```ts
isSampleDomainPart(part)
isSynth3DPart(part)
isBass3DPart(part)
getInstrumentDomain(part)
normalizeLegacyInstrumentState(part)
```

## Target behavior

- Kick/Snare/Perc/Hat/sample-domain slots cannot become synthesizer voices.
- 3D Synth selection navigates/selects a Synth3D part rather than mutating a drum slot.
- 3D Bass selection navigates/selects a Bass3D part rather than mutating a drum slot.
- sample-domain transformations remain available.
- legacy hybrid state is migrated explicitly or retained via compatibility representation until safe conversion is possible.

## Verification gates

- no invalid UI source transitions
- persisted legacy state loads deterministically
- sample slot identity survives save/load
- Synth3D/Bass3D remain playable
- undo/redo remains valid
- typecheck/lint/tests
- E2E Sample/Synth safety cases
