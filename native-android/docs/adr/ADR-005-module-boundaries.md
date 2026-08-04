# ADR-005 — Module Boundaries and Bridge Architecture

**Status:** ACCEPTED (bridge: current) / OPEN (JSI path: future)  
**Date:** 2026-08-01  
**Decider:** Executive Platform Engineering Board

---

## Context

VibeCore is currently a React/Vite web application running inside an Android WebView, with native audio accessed via `@JavascriptInterface`. The architecture documents reference JSI/TurboModule, but the project has no React Native dependency.

Two decisions are needed:
1. How are C++ modules bounded from each other (internal)
2. How does JavaScript communicate with native (external bridge)

## Decision A — Internal Module Boundaries

**Each audio module (Groove, Bass, Synth, etc.) is an `AudioNode` subclass in the graph. Modules communicate exclusively through the graph's AudioBus connections or through the AudioCommand queue. Direct cross-module calls are forbidden.**

```
JavaScript
    ↓ (bridge)
VibeCoreAudioEngine
    ↓ (commands via AudioThreadSafeQueue)
AudioGraphManager
    ├── GrooveNode      (Phase 2)
    ├── BassNode        (Phase 2)
    ├── SynthNode       (Phase 2)
    ├── VoiceNode       (Phase 3)
    ├── FXNode          (Phase 3)
    └── MixerNode       (output)
```

No module has a reference to another module. All routing goes through the graph.

## Decision B — External Bridge (Current: WebView JavascriptInterface)

**Current mechanism:** `NativeAudioBridge.kt (@JavascriptInterface)` → JNI (`bridge/jni_bridge.cpp`) → `VibeCoreAudioEngine`

This is the production bridge for Phase 1–2. It is:
- Functional on all supported API levels (21+)
- Simple to debug and extend
- Sufficient for current JavaScript → Native parameter updates

**The bridge exposes NO business logic.** It is a thin marshalling layer only.

## Open Question — JSI / TurboModule Path

**Status: OPEN — not implemented, blocked pending architectural decision**

The constitutional documents reference JSI/TurboModule. This requires:
1. Migrating from React/Vite to React Native — a major architectural change
2. Or: implementing a C++ JSI host object within the WebView (experimental, non-standard)

**Recommendation:** The current WebView + JavascriptInterface bridge is production-quality for Phase 1–3. The JSI migration should be evaluated as a separate architectural decision after Phase 2 modules are stable. It is not a blocker for audio quality or latency.

**Decision gate for JSI migration:**
- Is the JavaScript → Native round-trip latency a measured bottleneck? (Measure first)
- Is React Native migration justified by the feature roadmap?
- Can the existing WebView bridge be replaced without regressing any Phase 2 features?

If all three are YES: plan JSI as a dedicated platform task.

## Consequences

- **Positive (A):** Modules are independently testable; graph routing is explicit and inspectable
- **Positive (B):** Bridge works today; no migration risk; simple JNI debugging
- **Negative (B):** `@JavascriptInterface` calls are synchronous from JS perspective; no streaming/subscription API
- **Risk (OPEN):** Legacy `jni_bridge.cpp` (old) exports symbols with the same `Java_com_vibecore_audio_NativeAudioBridge_*` prefix. The new `bridge/jni_bridge.cpp` must replace it, not coexist. CMakeLists.txt excludes the old file; this must be verified at build time.

## Enforcement

- `bridge/jni_bridge.cpp` contains ONLY JNI marshalling (assert in review: no business logic)
- `VibeCoreAudioEngine` API surface is the contract for the bridge
- New JNI functions require a corresponding `NativeAudioBridge.kt` update (reviewed together)

## Review trigger

Revisit if: measured JS→native latency exceeds 5 ms, or React Native migration is decided at product level.
