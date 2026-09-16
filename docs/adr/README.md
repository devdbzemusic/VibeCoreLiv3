# Architecture Decision Records

This directory contains architecture decisions for the v4 runtime revision.

## Active

- `ADR-0001-sample-synth-boundaries.md` — strict Sample / 3D Synth / 3D Bass ownership
- `ADR-0002-runtime-authority-call-graph-truth.md` — source-proven runtime/audio/sync authority before refactoring

## Rule

Changes affecting core contracts, persisted state, runtime ownership, timing, parameter ownership, capability ownership or backend boundaries require an ADR plus migration/rollback considerations where applicable.

`ADR-0002` is a precondition gate: runtime-affecting migration/refactoring must not be based on diagrams, comments or historical reports alone. The current source call graph must be proven first.
