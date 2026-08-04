# ADR-002 — Five-Thread Model with Lock-Free Audio Communication

**Status:** ACCEPTED  
**Date:** 2026-08-01  
**Decider:** Executive Platform Engineering Board

---

## Context

Real-time audio on Android requires strict thread separation. The Oboe audio callback runs on a high-priority thread managed by the OS. Any blocking operation (mutex, malloc, file I/O, JNI) on this thread causes an audio dropout (XRun).

VibeCore needs to handle:
- Audio rendering (< 2 ms budget at 48 kHz / 96 frames)
- UI parameter updates (gain, tempo, note triggers)
- Sample loading (potentially large files)
- MIDI event scheduling
- Background AI/computation

## Decision

**Five distinct threads with strict ownership boundaries and lock-free SPSC queues for control → audio communication.**

| Thread | Priority | Owned by | Communication |
|--------|----------|----------|---------------|
| Audio | Real-time (Oboe) | OS/Oboe | AudioThreadSafeQueue (consumer) |
| UI | Normal (Android main) | Android | AudioThreadSafeQueue (producer) |
| Worker | Below-normal | Platform | AudioThreadSafeQueue (producer) |
| File I/O | Below-normal | Platform | Atomic pointer swap after load |
| MIDI | Above-normal | Platform | AudioThreadSafeQueue (producer) |

**Communication rules (enforced by `VIBECORE_ASSERT_NOT_AUDIO_THREAD()` in debug):**

```
UI/Worker/MIDI → Audio:   AudioThreadSafeQueue<Command, 256>  (wait-free)
File I/O → Audio:          Pre-load buffer, then atomic<SampleBuffer*> swap
Audio → UI:                Atomic reads (meters, latency, XRun count) only
Audio → UI (events):       Atomic flag poll from UI thread (restartRequested)
```

## Rationale

| Alternative | Reason rejected |
|-------------|-----------------|
| Mutex-protected shared state | Mutex on audio thread → XRun on contention |
| std::queue with mutex | Same problem |
| Double-buffering with memcpy | Adds one callback of latency |
| Lockless ringbuffer (3rd party) | AudioThreadSafeQueue is simpler, zero-dep, proven |

The `AudioThreadSafeQueue<T, N>` is a textbook lock-free SPSC ring buffer:
- Zero dynamic allocation after construction
- Cache-line aligned head/tail to prevent false sharing
- Wait-free producer and consumer
- T must be trivially copyable (enforced by `static_assert`)

## Forbidden on Audio Thread

The following are compile-time or lint violations (enforced by code review):

```
❌ malloc / new / delete
❌ std::vector::push_back (may allocate)
❌ std::string construction
❌ Any mutex (std::mutex, pthread_mutex)
❌ File I/O (open, read, write, fflush)
❌ JNI calls
❌ C++ exceptions (disabled by -fno-exceptions)
❌ RTTI (disabled by -fno-rtti)
❌ Logging in hot render path (VLOG_AUDIO_* only on lifecycle events)
```

## Consequences

- **Positive:** Zero-dropout guarantee under normal load; deterministic callback duration
- **Negative:** Parameter changes have up to 1 callback of latency (~2 ms) — acceptable for VibeCore use cases
- **Risk (OPEN):** The legacy `vibecore_engine.cpp` uses direct mutation from JNI without a queue. This is a known race condition documented in the Phase 1 report and must be resolved before Phase 2.

## Review trigger

Revisit if: multi-producer scenarios exceed the SPSC queue assumption, or if MIDI requires < 1-callback scheduling precision.
