# VibeCoreLiv3 — Sample/Synth Migration Contract

Status: SOURCE CONTRACT IMPLEMENTED / STORE ADOPTION PENDING
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

`src/lib/instruments/sourceBoundary.ts` now owns the pure classification/migration rules:

- `instrumentAuthorityForCategory()`
- `canonicalSourceForCategory()`
- `sourceBoundaryDecision()`
- `migratePersistedSource()`
- `canSelectSourceMode()`

The module does not mutate Zustand, UI, audio, or persisted data directly.

## 4. Reversible v12 -> v13 migration rule

For every persisted Part:

1. read `category`
2. read legacy `source`
3. resolve canonical source from category
4. when already canonical, keep the source without compatibility metadata
5. when non-canonical, switch the active runtime source to the canonical value **and preserve the original value** as compatibility metadata

Required compatibility record:

```ts
{
  source: "sample" | "synth" | "hybrid",
  reason:
    | "legacy-synth-on-sample-domain"
    | "legacy-hybrid-source"
    | "legacy-sample-on-synth-authority",
  migratedBySchema: 13
}
```

The original value must not be silently discarded.

## 5. Store adoption still required

The following integration is intentionally not claimed complete yet:

- add v13-compatible persisted metadata field to Part/project serialization
- update `buildDefaultParts()` so drum/sample-domain slots start as `sample`
- replace the legacy `setPartSource()` normalization with `canSelectSourceMode()` / canonical ownership
- migrate persisted v12 Part sources through `migratePersistedSource()`
- preserve legacy compatibility metadata through subsequent saves
- prevent UI controls from offering invalid source transitions
- move drum Tone/Decay controls away from legacy synth-generation semantics where necessary
- migrate runtime routing/trigger reads of `Part.source`

## 6. Tests added

`src/lib/instruments/__tests__/sourceBoundary.test.ts` statically defines expected ownership and reversible migration behavior.

The tests cover:

- all sample-domain categories
- Synth3D ownership
- Bass3D ownership
- invalid synth-on-drum detection
- legacy hybrid preservation
- legacy sample-on-synth preservation
- no compatibility metadata for already canonical state

These tests are SOURCE-ADDED only. They are not marked executed or passing until an actual test run produces evidence.

## 7. Risk note

Changing `allowedSourcesForCategory()` globally before every caller is inventoried could alter UI and runtime behavior implicitly. The revision therefore introduces the new authority contract first and migrates callers explicitly.

This preserves the v4.0 rule: no hidden architecture switch and no fabricated verification.
