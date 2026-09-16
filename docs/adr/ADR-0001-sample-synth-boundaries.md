# ADR-0001 — Sample / Synth Instrument Boundaries

Status: ACCEPTED FOR REVISION
Date: 2026-09-16

## Context

The canonical v4.0 engineering specification requires strict sample-slot integrity:

- sample slots remain sample/audio contexts
- drum/sample slots do not silently become synthesizer voice generators
- general synthesis belongs to the 3D Synth context
- bass synthesis belongs to the 3D Bass context

The current domain model still exposes legacy source modes:

```ts
type SourceMode = "sample" | "synth" | "hybrid";
```

and permits these modes for multiple non-generic part categories.

## Decision

VibeCore will migrate to explicit instrument ownership.

### Sample-domain parts

Sample-domain parts retain sample/audio transformations only:

- load/play sample
- slicing
- start/end/loop/reverse
- pitch/time processing
- granular/freeze processing
- filters/channel/FX/routing
- automation

### 3D Synth

General synthesizer voice generation belongs to 3D Synth parts/context.

### 3D Bass

Bass synthesizer generation belongs to 3D Bass parts/context.

### Legacy hybrid state

Legacy `hybrid` state will not be silently discarded.

It must be handled through explicit migration/compatibility logic. Where a legacy project contains hybrid/synth state on a sample-domain slot, the loader must preserve enough information for reversible migration or legacy compatibility rather than mutating the project invisibly.

## Consequences

Positive:

- aligns with v4.0
- removes ambiguous ownership
- reduces UI complexity
- simplifies AI/parameter validation
- reduces hidden audio-engine branching

Cost:

- model changes
- project migration
- UI source controls need revision
- tests must change
- serialization/presets may require compatibility handling

## Migration strategy

1. Inventory every read/write of `Part.source` and source-mode helpers.
2. Introduce explicit helper contracts that distinguish sample-domain, Synth3D and Bass3D parts.
3. Add compatibility normalization for persisted legacy projects.
4. Remove or disable invalid UI transitions.
5. Migrate runtime trigger/routing decisions.
6. Add regression tests for old project payloads.
7. Remove legacy source modes only after all reads/writes are migrated.

## Rollback

The revision branch preserves the previous `main` implementation. Within the migration itself, compatibility decoding must retain legacy source values until migration evidence is complete.

## Verification requirement

Do not mark this ADR implementation complete until:

- static references are migrated
- typecheck/lint/tests pass
- legacy state migration tests pass
- Sample/Synth E2E checks pass
- Android/native behavior is verified where affected
