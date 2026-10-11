# VibeCoreLiv3 — Revision Execution Policy

## Working mode

- reuse before new code
- no broad feature expansion during consolidation
- no second clock/state/parameter/runtime architecture
- reversible changes first
- migration before destructive cleanup
- performance measurements before optimization claims
- user-facing behavior stays stable unless an intentional UX revision is documented
- every architecture change receives impact + rollback consideration

## Branching

Revision work is developed on `revision/v4-runtime-consolidation` and reviewed through Draft PR #1 before merge to `main`.

## Verification language

Only the v4 statuses are used for claims: VERIFIED, STATICALLY VERIFIED, EXPECTED, UNKNOWN, NOT EXECUTED.
