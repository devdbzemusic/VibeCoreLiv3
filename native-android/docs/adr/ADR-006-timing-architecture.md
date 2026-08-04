# ADR-006 — VibeCore Sync: Single Global Clock Architecture

**Status:** ACCEPTED  
**Date:** 2026-08-01  
**Decider:** Executive Platform Engineering Board

---

## Context

Every DAW/groovebox needs a timing authority. The naive approach is for each module to run its own clock, but this inevitably causes drift as audio callbacks don't fire at exactly regular intervals.

VibeCore requires:
- Sample-accurate event scheduling (note-on at the exact correct sample)
- Consistent tempo across Groove, Bass, Synth, Voice, FX
- No drift between modules over time
- Loop playback without stuttering or skipped beats
- Mid-playback tempo changes without a phase jump

## Decision

**One global `VibeCoreSync` instance. No module has its own clock. All timing derives from the absolute audio-thread sample counter.**

```
PPQ = 1920 (fixed — never configurable by users or modules)

Tick n fires at sample:
  sampleN = transportStartSample + n * (sampleRate * 60.0 / (bpm * PPQ))

Per callback:
  Find all n where sampleN ∈ [callbackStart, callbackStart + numFrames)
  Dispatch TickEvent with sampleOffset = sampleN - callbackStart
```

PPQ 1920 was chosen because it is divisible by:
- 1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 16, 20, 24, 30, 32, 40, 48, 60, 64, 80, 96, 120, 128, 160, 192, 240, 320, 384, 480, 640, 960, 1920

This allows subdivision of any common musical value (1/64, 1/32, triplets, quintuplets) without rounding.

## Timing Data Flow

```
Audio Thread callback (Oboe)
    │
    ▼
VibeCoreSync::processCallback(absoluteSamplePos, numFrames)
    │   drainCommands()           ← apply SetTempo, TransportStart, etc.
    │   scheduleTicksInRange()    ← find all ticks in this callback window
    │   → TickEventBuffer         ← stack-allocated, max 64 events
    │
    ▼
AudioGraphManager::dispatchSyncEvents(TickEventBuffer)
    │   for each event:
    │     for each node (in topological order):
    │       node->onTick(absoluteTick, position, sampleOffset)
    │       node->onBeat(...)  ← if tick % PPQ == 0
    │       node->onBar(...)   ← if beat == 0 && tick == 0
    │       node->onLoop(...)  ← if loop boundary crossed
    │
    ▼
AudioGraphManager::process()
    │   node->process(input, output, numFrames, numChannels)
    │   (nodes have already scheduled their events in onTick/onBeat/onBar)
    ▼
Oboe output buffer
```

## Thread Safety

| Operation | Thread | Mechanism |
|-----------|--------|-----------|
| `play()`, `stop()`, `setTempo()` | UI Thread | SyncCommand → AudioThreadSafeQueue<SyncCommand, 128> |
| `processCallback()` | Audio Thread | Reads from queue, operates on private AudioThreadState |
| `isPlaying()`, `currentTick()` | Any thread | std::atomic<> reads (relaxed, approximate) |
| TickEvent dispatch | Audio Thread | Stack-local TickEventBuffer, no allocation |

The `AudioThreadState` struct (`mAT`) is private to the Audio Thread. It is NEVER accessed from any other thread. All parameter mutations happen via the command queue. This eliminates all races on timing state.

## Loop Architecture

Loop is implemented by resetting `nextTick` to `loopStartTick` when `nextTick >= loopEndTick`. The `playheadSample` is recalculated from the new tick position. This gives exact loop-point accuracy within ±1 sample of the specified loop end tick.

## Consequences

- **Positive:** Zero drift between modules; sample-accurate note scheduling; deterministic behavior; single source of truth for bar/beat/tick
- **Positive:** Tempo changes take effect within the next audio callback (~2 ms latency) without phase jump
- **Positive:** Loop boundaries are sample-accurate (tested at loop end = tick N, loop start = tick M, transition is seamless)
- **Negative:** All modules must implement the `AudioNode` timing interface — they cannot bypass the sync layer
- **Negative:** The command queue has 128 slots; a burst of >128 sync commands before the next callback drains them will drop the oldest. Acceptable: UI typically sends 1–3 commands per user action
- **Risk (OPEN):** `VibeCoreSync::scheduleTicksInRange()` uses a `double`-precision floating-point calculation for tick-to-sample conversion. At extreme session lengths (>24 hours continuous) the double may accumulate fractional error. Mitigation: use integer arithmetic with remainder tracking in Phase 3 if needed.

## Alternatives Rejected

| Alternative | Reason rejected |
|-------------|-----------------|
| Per-module clock | Inevitable drift; complex sync protocol between modules |
| System clock (CLOCK_MONOTONIC) | Not tied to audio samples; drift with audio callback jitter |
| MIDI clock (external) | Phase 3 feature; cannot be the primary clock |
| Fixed-rate timer thread | Not sample-accurate; requires extra synchronisation |

## Review trigger

Revisit if: session length > 24 hours is required, MIDI clock sync is needed (Phase 3), or external hardware sync (Ableton Link, SMPTE) is required.
