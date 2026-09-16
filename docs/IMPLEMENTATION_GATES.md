# VibeCoreLiv3 — Implementation Gates

## Gate B — Sample/Synth migration
Must satisfy before destructive legacy cleanup:
- all source-mode reads/writes inventoried
- compatibility path exists
- UI cannot create invalid new state
- tests cover legacy payload normalization

## Gate C — Runtime contract
- UI backend-specific calls inventoried
- runtime facade covers transport/performance/parameters/assets/diagnostics
- Web/native adapters preserve behavior

## Gate D — Parameter Hub
- typed IDs
- subscriptions
- gesture lifecycle
- automation/AI/preset integration
- no duplicate parameter truth

## Gate E — Capability Registry
- typed capability IDs
- backend providers
- UI gating
- fallback reason

## Gate F+ — Performance
No optimization is called successful without before/after evidence.
