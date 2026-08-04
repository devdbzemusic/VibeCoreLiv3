# ADR-003 — Directed Acyclic Graph for Audio Routing

**Status:** ACCEPTED (Phase 1: infrastructure only)  
**Date:** 2026-08-01  
**Decider:** Executive Platform Engineering Board

---

## Context

VibeCore Univers has 9 creative modules that all produce audio: Groove, 3D Synth, 3D Bass, Voice, Sample Forge, Wave, FX MIX LAB, AI ARP. These must be combined into a single stereo output.

Options:
1. Hard-coded mixer (each module writes to a shared buffer directly)
2. Fixed bus architecture (fixed N send buses, like a hardware mixer)
3. Directed Acyclic Graph (DAG) of AudioNodes

## Decision

**Use a DAG-based AudioGraphManager with typed AudioNode interfaces and AudioBus connections.**

The graph is static during audio playback (topology changes happen on UI thread before/after stream). Nodes are processed in topological order each callback.

```
Phase 1:   Empty graph → silence (validates pipeline)
Phase 2:   GrooveNode, BassNode, SynthNode → MixerNode → Output
Phase 3+:  FXNode, VoiceNode, SideChain, Sends, Returns
```

## Rationale

| Alternative | Reason rejected |
|-------------|-----------------|
| Hard-coded mixer | Not extensible; adding a module requires engine changes |
| Fixed bus (N channels) | Inflexible routing; no sidechain/send support |
| Runtime-dynamic graph | Topology changes during audio thread → allocations → XRuns |

The DAG approach:
- Modules are independent (can be added/removed without touching engine code)
- Supports complex routing (sidechain, parallel FX, wet/dry)
- Topological sort ensures correct render order
- Static during playback = no locking on audio thread

## Node interface contract

```cpp
class AudioNode {
    virtual void prepare(int sampleRate, int maxFrames);   // UI thread, pre-stream
    virtual void process(const float* in, float* out,      // Audio thread only
                         int frames, int channels) noexcept;
    virtual void reset();                                   // UI thread, post-stream
};
```

## Consequences

- **Positive:** Module isolation; extensible without engine changes; clean Phase 2 integration path
- **Negative:** Topological sort overhead on graph changes (acceptable: happens on UI thread, not hot path)
- **Open:** Graph cycle detection is basic in Phase 1. Full cycle detection with error reporting is a Phase 2 task.
- **Open:** Multi-threaded node processing (parallel branches) is not implemented. All nodes process serially. Revisit if CPU becomes bottleneck with many nodes.

## Phase 1 state

The graph is empty. `AudioGraphManager::process()` outputs silence and measures overhead (~0.1 µs). This validates the dispatch pipeline before any nodes are added.

## Review trigger

Revisit if: node count exceeds 64 (current kMaxNodes limit), or parallel branch processing becomes necessary for CPU budget.
