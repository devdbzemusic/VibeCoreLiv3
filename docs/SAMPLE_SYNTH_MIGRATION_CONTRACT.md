# VibeCoreLiv3 — Sample/Synth Migration Contract

Status: SOURCE + MIGRATION + WRITE/UI POLICY IMPLEMENTED / STORE ADOPTION PENDING
Date: 2026-09-16
Canonical spec: v4.0
ADR: `docs/adr/ADR-0001-sample-synth-boundaries.md`

## 1. Verified current-state problem

The current v12 model exposes:

```ts
type SourceMode = "sample" | "synth" | "hybrid";
```

and the legacy helper currently allows `sample`, `synth`, and `hybrid` for every category except the generic `sample` category.

`buildDefaultParts()` also initializes every non-`sample` category with `source: "synth"`. That means kick/snare/perc/hat currently start as synthesizer-owned slots even though v4.0 defines those as sample-domain contexts.

The v12 Zustand persistence migration discards schemas older than v12 and returns v12+ persisted state unchanged. Therefore legacy invalid source ownership can survive rehydration today.

The current `SoundTab` SOURCE UI also presents `sample`, `synth`, and `hybrid` buttons and shows `HybridPanel` whenever `p.source === "hybrid"`. This is legacy UI behavior and conflicts with the v4 ownership decision.

## 2. Canonical v4 ownership

| Part category | Authority | Canonical runtime source |
| --- | --- | --- |
| kick | sample-domain | sample |
| snare | sample-domain | sample |
| perc | sample-domain | sample |
| hat | sample-domain | sample |
| sample | sample-domain | sample |
| synth | synth3d | synth |
| bass | bass3d | synth |

`hybrid` has no canonical runtime authority in v4.0. It remains readable as legacy compatibility data only until an explicit future feature contract reintroduces it.

## 3. Implemented source contract

`src/lib/instruments/sourceBoundary.ts` owns the pure classification/migration rules:

- `instrumentAuthorityForCategory()`
- `canonicalSourceForCategory()`
- `sourceBoundaryDecision()`
- `migratePersistedSource()`
- `canSelectSourceMode()`

The module does not mutate Zustand, UI, audio, or persisted data directly.

## 4. Implemented v13 project migration core

`src/lib/instruments/projectMigration.ts` now provides a pure v12 -> v13 project migration layer:

- `PROJECT_SCHEMA_VERSION = 13`
- `migratePartToV13()`
- `migrateProjectToV13()`
- `migratePersistedProject()`

The migration:

1. keeps the complete persisted project shape intact
2. canonicalizes only recognized Part category/source pairs
3. preserves every non-canonical old source under `legacyInstrument.source`
4. does not mutate the input project or input Part array
5. deliberately does not pretend to reconstruct pre-v12 Pattern/Scene state

### Compatibility record

```ts
legacyInstrument: {
  source: {
    source: "sample" | "synth" | "hybrid",
    reason:
      | "legacy-synth-on-sample-domain"
      | "legacy-hybrid-source"
      | "legacy-sample-on-synth-authority",
    migratedBySchema: 13
  }
}
```

The original value is therefore reversible/auditable instead of silently discarded.

## 5. Implemented new-write policy

`src/lib/instruments/sourcePolicy.ts` defines the rule for newly created or newly edited state:

- `resolveSourceWrite()` rejects non-canonical source transitions
- `canonicalizeNewPart()` fixes freshly-created Part defaults without touching persisted legacy projects
- `canonicalizeNewParts()` applies the same rule to new Part sets

Important distinction:

- **persisted old data** -> `projectMigration.ts`
- **new/default state and new writes** -> `sourcePolicy.ts`

This avoids destroying legacy intent while preventing new invalid state.

## 6. Implemented UI policy

`src/lib/instruments/sourceUiPolicy.ts` now defines source-selector presentation:

- sample-domain categories expose only Sample authority
- synth category exposes only 3D Synth authority
- bass category exposes only 3D Bass authority
- Hybrid editor is disabled by canonical policy
- preserved legacy source state may be shown as a compatibility notice but does not reopen invalid source buttons

The policy is pure and does not mutate the store.

## 7. Store/UI adoption still required

The following mechanical integration is intentionally not claimed complete yet:

- set Zustand persist schema version to 13
- call `migratePersistedProject()` from the persist migration hook
- add/persist `legacyInstrument` compatibility metadata on migrated Parts
- canonicalize `buildDefaultParts()` output using `canonicalizeNewParts()` or equivalent model-level ownership
- replace `setPartSource()` legacy normalization with `resolveSourceWrite()`
- migrate `SoundTab` SOURCE UI to `sourceUiPolicyForPart()`
- remove the interactive Hybrid source selector/editor from new v4 workflows while keeping compatibility display/export capability
- move drum Tone/Decay controls away from legacy synth-generation semantics where necessary
- inventory/migrate runtime trigger/routing reads of `Part.source`

These two large files are currently not being replaced through the GitHub connector from truncated payloads:

- `src/lib/store.ts`
- `src/components/groovebox/SoundTab.tsx`

That is a tooling-safety decision, not an architectural blocker. Both changes are mechanically defined by the modules above.

## 8. Tests added

Source-level regression tests now exist for:

- `sourceBoundary.test.ts`
- `projectMigration.test.ts`
- `sourcePolicy.test.ts`
- `sourceUiPolicy.test.ts`

Covered behavior includes:

- all sample-domain categories
- Synth3D ownership
- Bass3D ownership
- invalid synth-on-drum detection
- legacy hybrid preservation
- legacy sample-on-synth preservation
- canonical v12 -> v13 project migration
- non-mutating project migration
- rejection of new invalid source writes
- default-Part canonicalization
- UI authority visibility
- legacy compatibility notice without re-enabling invalid UI modes

These tests are SOURCE-ADDED only. They are not marked executed or passing until an actual test run produces evidence.

## 9. Risk note

Changing the legacy helpers globally before every caller is inventoried could alter UI and runtime behavior implicitly. The revision therefore introduces one explicit ownership authority and migrates callers deliberately.

This preserves the v4.0 rules:

- no hidden architecture switch
- no silent data loss
- no duplicate ownership logic
- no fabricated verification
