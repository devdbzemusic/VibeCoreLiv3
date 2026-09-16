# VibeCoreLiv3 — Implementation Gates

## Gate B0 — Runtime Authority & Call-Graph Truth
This gate blocks runtime-affecting migration/refactoring until the real current-HEAD graph is proven.

Must satisfy:
- exact `AudioBackend` contract inventoried
- all implementations and instantiations inventoried
- all `nativeAudioRuntime` call sites inventoried
- TypeScript → Kotlin mapping complete
- Kotlin → JNI symbol mapping complete
- JNI → C++ engine mapping complete
- C++ → Oboe stream/data-callback ownership proven
- callback → mixer/DSP → output graph proven
- `masterClock.ts` and all musical scheduler lifecycles traced
- scheduler → trigger → voice allocation/start → DSP/output proven
- all `setInterval`, `setTimeout`, `requestAnimationFrame`, `Date.now`, `performance.now`, `AudioContext.currentTime` and native clock uses classified for musical timing risk
- missing edges explicitly marked `UNKNOWN`
- contract/null/timing tests defined against the observed graph

No CPU/RAM/xRun/jitter/latency/callback performance result may be claimed without executed evidence.

## Gate B — Sample/Synth migration
Must satisfy before destructive legacy cleanup:
- Gate B0 complete where runtime ownership/timing is affected
- all source-mode reads/writes inventoried
- compatibility path exists
- UI cannot create invalid new state
- tests cover legacy payload normalization

## Gate C — Runtime contract
- Gate B0 complete
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
