# ADR-004 — Memory Strategy: Pre-Allocate, Never Allocate on Audio Thread

**Status:** ACCEPTED  
**Date:** 2026-08-01  
**Decider:** Executive Platform Engineering Board

---

## Context

Dynamic memory allocation (malloc/new) on the audio callback thread causes non-deterministic latency spikes of 0.1–10 ms depending on the allocator and heap state. On Android, the system allocator is not real-time safe.

VibeCore targets < 10 ms total round-trip latency. A single allocation in the audio callback can consume the entire latency budget.

## Decision

**All memory used by the audio callback path must be pre-allocated at `prepare()` time on the UI thread. Zero allocations on the Audio Thread during steady-state operation.**

### Rules by memory type

| Memory type | When allocated | Where |
|------------|---------------|-------|
| AudioBus buffers | `AudioGraphManager::prepare()` | `std::vector<float>` on heap, owned by `AudioBus` |
| AudioNode scratch buffers | `AudioNode::prepare()` | Each node allocates once |
| AudioThreadSafeQueue | Constructor | Fixed-size array, stack-like |
| Sample data (Phase 2) | `FileIOThread`, then atomic swap | `std::vector<float>` pre-loaded |
| Diagnostic strings | UI thread only | `std::string` never on audio thread |

### Forbidden patterns on Audio Thread

```cpp
// ❌ FORBIDDEN
std::vector<float> temp(numFrames * 2);   // heap allocation
std::string msg = "processing";            // heap allocation
mNodes.push_back(newNode);                 // heap reallocation

// ✅ CORRECT
static std::array<float, 96 * 2> scratch; // stack, fixed size
// OR: pre-allocated member buffer used in-place
```

## Rationale

| Alternative | Reason rejected |
|-------------|-----------------|
| Real-time allocator (TLSF, jemalloc) | Complexity; NDK integration; still non-deterministic |
| Per-callback stack allocation | Limited stack size on audio thread (~64 KB on Android) |
| Pre-allocated pool with free-list | Acceptable for Phase 3, over-engineered for Phase 1 |

The simplest strategy for Phase 1–2: pre-allocate everything at `prepare()`. A memory pool can be added in Phase 3 if needed for dynamic effects chains.

## Enforcement

1. **CMake flag:** `-fno-exceptions` — prevents exception-driven allocation paths
2. **Code review rule:** Any `new`, `delete`, `std::vector::push_back`, or `std::string` construction in an `AudioNode::process()` implementation is a **build-blocking review failure**
3. **Phase 2 tooling:** Consider AddressSanitizer + custom allocator that aborts on audio-thread allocation in CI

## Consequences

- **Positive:** Deterministic callback duration; no GC pauses; predictable worst-case latency
- **Negative:** Pre-allocation increases memory footprint (acceptable for audio apps)
- **Risk (OPEN):** The legacy `vibecore_engine.cpp` sample loading uses `std::vector::assign()` from the JNI thread. This is not on the audio thread but races with voice rendering. Fix required in Phase 2.

## Review trigger

Revisit if: dynamic DSP graphs (add/remove effects at runtime during playback) are required. That case needs a real-time memory pool.
