# ADR-001 — Oboe as the Single Native Audio Engine

**Status:** ACCEPTED  
**Date:** 2026-08-01  
**Decider:** Executive Platform Engineering Board

---

## Context

VibeCore Univers requires low-latency audio output on Android devices spanning API 21 (Android 5) through current releases. Multiple audio APIs exist: OpenSL ES (legacy), AAudio (API 26+), and Oboe (abstraction layer).

The platform must:
- Achieve < 10 ms round-trip latency on modern devices
- Support API 21 as minimum
- Provide a single audio engine shared by all modules (Groove, Bass, Synth, Voice, FX)
- Remain maintainable as Android audio APIs evolve

## Decision

**Use Google Oboe 1.9.0 as the single and only native audio engine.**

There is exactly ONE `VibeCoreAudioEngine` instance per process. All modules connect through `AudioGraphManager`. No module instantiates its own audio stream.

## Rationale

| Alternative | Reason rejected |
|-------------|-----------------|
| Raw AAudio only | Requires API 26+; no fallback for API 21–25 |
| Raw OpenSL ES only | Deprecated; higher latency; no ADPF support |
| Web Audio API only | No exclusive mode; ~50ms latency; no PCM sample control |
| Multiple engine instances | Conflicting audio focus; increased latency; double buffering |

Oboe:
- Automatically selects AAudio (API 26+) or OpenSL ES (API 21–25)
- Provides exclusive mode for lowest latency where available
- Abstracts stream lifecycle, error recovery, and device changes
- Used in production by Google, Spotify, and professional audio apps

## Consequences

- **Positive:** Single audio thread; no cross-stream synchronisation needed; automatic AAudio/OpenSL ES selection; ADPF support on API 31+
- **Negative:** Oboe version updates require careful testing; NDK dependency
- **Risk:** Exclusive mode may not be available on all devices → Shared mode fallback is implemented and tested

## Configuration

```
Sample rate:     48000 Hz (device optimal via DefaultStreamValues)
Buffer size:     device burst size (typically 96–256 frames)
Format:          Float32 interleaved stereo
Performance:     LowLatency + Exclusive (Shared fallback)
ADPF:            Enabled on API 31+
```

## Review trigger

Revisit if: Oboe drops below 1.8.0 support, new Android audio API supersedes AAudio, or latency target < 5 ms requires platform-specific implementation.
