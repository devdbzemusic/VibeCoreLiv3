# ADR-008 — VibeCore Voice Architecture (Phase 6)

**Status:** Accepted
**Date:** 2026-08-04
**Phase:** 6 — VibeCore Voice (Vocal Engine, Formant Processing & Live Voice Integration)

## Context

Phase 6 adds a native vocal instrument to the VibeCore audio platform. It must:
- run as an AudioNode inside the ONE engine / ONE clock architecture (Architecture Freeze, Phase 4),
- support Live Voice (microphone), Sample, Instrument, and Texture modes,
- provide pitch shift, formant shift, harmonizer, doubler, gate, de-esser,
  compressor, EQ, breath layer, and M/S 3D stereo,
- integrate with Groove (sequencer/piano-roll triggers) and VibeCore Sync,
- respect all realtime-safety rules (no malloc/locks/JNI on the Audio Thread).

## Decisions

### 1. VoiceNode is an AudioNode (NodeId = 3)
Same pattern as GrooveNode (1) and BassNode (2): commands via SPSC queue,
all seven sync callbacks implemented, processing inside `process()` only.
No own clock, no own thread, no own engine.

### 2. Live input: Oboe input stream in NON-callback mode
`VoiceInput` opens an input stream without a data callback. The single output
callback pulls available frames with `read(timeout = 0)` — non-blocking and
realtime-safe per Oboe full-duplex guidance. This avoids a second audio
callback thread, which would violate the Architecture Freeze (ONE clock).
An `std::atomic<bool>` gates Audio-Thread access; the UI thread clears the
gate before closing the stream.

### 3. Module decoupling — Voice owns its DSP helpers
Voice implements its own envelope/LFO/biquad/EQ/M-S helpers instead of
including `bass/` headers. Rule: no module depends on another module's
internals. The cost (small code duplication) is accepted for isolation.

### 4. Sample memory: deferred-free protocol
UI thread (VoiceEngine) owns sample buffers (`unique_ptr<float[]>` per slot,
current + retired). Pointers are published to the Audio Thread via command.
A retired buffer is freed only on the *next* load of the same slot — by then
the Audio Thread has long drained the replacing command. The Audio Thread
never frees memory.

### 5. Groove → instrument trigger routing (fixes latent Phase 5 gap)
`TrackMode::Voice = 4` added. GrooveNode holds raw target pointers
(`setBassTarget` / `setVoiceTarget`, set on the UI thread by the JNI bridge
at node creation, before the stream starts). In GrooveNode's trigger drain,
triggers are routed by track mode: Drum/Sample → internal VoicePool,
Bass → `BassNode::notifyGrooveTrigger`, Voice → `VoiceNode::notifyGrooveTrigger`.
Direct Audio-Thread call — zero latency, no queue hop. (Phase 5 declared the
Bass path but never called it; Phase 6 wires both.)

### 6. Pitch/formant algorithms — quality/CPU tradeoff for mobile
- Pitch shift: dual-tap crossfaded delay-line (~46 ms window). O(1) per
  sample, deterministic, no FFT. Good for ±12 st vocal ranges.
- Formant shift: 4-band peaking approximation (cut at original, boost at
  shifted anchor positions). LPC-based spectral morphing is *prepared* but
  deferred (CPU budget on mid-range devices).
- Harmonizer: 4 independent shifter instances; Doubler: 2 detuned shifters
  with stereo spread.

### 7. JNI symbol repair
Kotlin `external fun nativeXxx` declarations require JNI symbols
`Java_..._nativeXxx`. All existing bridge functions (Phases 1–5) were named
without the `native` prefix — every native call would have thrown
`UnsatisfiedLinkError` (swallowed by the Kotlin try/catch). All symbols were
renamed to the `nativeXxx` convention; Phase 6 Voice follows it from the start.

## Consequences

- Voice ships with 8-unit polyphony, 16 mod routes, 8 sample slots, 16
  slices/slot, 4 harmony voices — all fixed-size, allocation-free on the AT.
- Vocoder, spectral layer, LPC formant morphing, and AI voice tools remain
  "prepared" (Phase 7+ candidates).
- Command payloads remain trivially copyable and ≤ 1024 bytes (static_assert).
