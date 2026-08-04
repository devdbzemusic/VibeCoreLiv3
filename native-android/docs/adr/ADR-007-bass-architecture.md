# ADR-007 — VibeCore 3D Bass Architecture

**Status:** ACCEPTED  
**Date:** 2026-08-04  
**Phase:** 5 — Native Wavetable Bass Engine  
**Authors:** Platform Engineering, DSP Architecture

---

## Context

Phase 4 froze the VibeCore Native Platform architecture. The first instrument module — VibeCore 3D Bass — must be implemented on the frozen platform without any architectural changes.

The MASTERPROMPT constraint is clear:
> *Es darf keine zweite Audio Engine, keine zweite Clock, kein eigener Scheduler und keine Architekturänderung entstehen.*

Two architectural approaches were considered:

**Option A — AudioNode (chosen):**
BassNode extends AudioNode. Registered in AudioGraphManager. Receives all timing events from VibeCoreSync via the existing AudioNode callback interface. Command queue follows the GrooveCommand queue pattern.

**Option B — Dedicated Engine:**
BassEngine owns its own Oboe stream and timing loop. ❌ REJECTED — violates "one engine, one clock" invariant.

---

## Decision

**Option A** — BassNode as AudioNode subclass.

---

## Signal Flow

```
VibeCoreSync
  ↓ (dispatchSyncEvents before process)
AudioGraphManager
  ↓
BassNode::onTick / onBeat / onBar / onTempoChanged
  ↓ noteOn/noteOff via BassVoicePool
BassNode::process()
  ↓ per-sample render
BassVoicePool::renderFrame()  [16 voices max]
  ↓
Bass3DStereo::processBuffer()  [M/S stereo, pan]
  ↓
MixerNode
  ↓
Effect Mix Lab (Phase 7+)
  ↓
Master Bus → Limiter → Oboe Output
```

---

## Module Breakdown

| Module | File | Role |
|--------|------|------|
| BassTypes.h | Types | All data types, enums, structs — trivially copyable |
| BassCommands.h | Commands | 50+ command types, SPSC queue payload |
| BassWavetable | DSP | 8 waveforms × 11 mip levels, anti-aliased, morphable |
| BassFilter | DSP | Biquad LP/HP/BP/Notch, RBJ cookbook, Direct Form 2 |
| BassEnvelope | DSP | ADSR, linear attack + exp decay/release, velocity scaling |
| BassLFO | DSP | Sine/Tri/Saw/Sq/S&H, free/beat/bar sync, retrigger |
| BassVoice | DSP | Full voice: oscillator + 2 envelopes + 2 LFOs + filter |
| BassVoicePool | Voice | 16 voices, free list O(1), deterministic stealing |
| Bass3DStereo | 3D | M/S matrix, stereo width, constant-power pan |
| BassNode | Integration | AudioNode, processes all timing callbacks, drains queue |
| BassEngine | UI | UI mirror, command dispatch, preset undo (32 depth) |

---

## Wavetable Design

- **8 built-in waveforms**: Sine, Triangle, Saw, ReverseSaw, Square, Pulse25, Custom0, Custom1
- **11 mip levels per waveform**: 2048 down to 2 samples (2:1 averaging downsample)
- **Mip selection**: highest mip level where `freq ≥ Nyquist / mip_size` (anti-aliasing)
- **Morphing**: linear crossfade between adjacent wavetable frames
- **Phase accumulator**: `double` precision, range [0, kWavetableSize)
- **Phase increment**: `frequencyHz × kWavetableSize / sampleRate`
- **All wavetable data pre-computed at `init()` time** — never on Audio Thread

---

## Voice Engine Design

- **16 voices maximum** (kBassMaxVoices)
- **Free list allocation**: O(1) — stack of free indices
- **Stealing strategy**: prefer voices in Release phase → oldest active voice
- **Mono/Legato**: 1 active voice; Legato reuses voice without envelope retrigger
- **Glide**: per-sample multiplicative convergence (exponential approach), `glideCoeff = pow(targetPitch/currentPitch, 1/glidesamples)`
- **All voice state pre-allocated**: no heap on Audio Thread

---

## Filter Design

- **Type**: Direct Form 2 biquad (numerically stable)
- **Design**: RBJ Audio EQ Cookbook (1994) bilinear transform
- **Q range**: 0.5 (resonance=0) to 20.0 (resonance=1)
- **Drive**: pre-filter Padé tanh approximation soft-clip
- **Anti-denormal**: constant offset `1e-25f` added to input
- **Stereo**: dual filter states (L/R), same coefficients
- **Coefficient recomputation**: triggered by dirty flag, executed on Audio Thread (pure arithmetic, no alloc)

---

## Modulation Matrix

- **16 routes** (kBassModRoutes)
- **Sources**: Env1, Env2, LFO1, LFO2, Velocity, KeyTracking, ModWheel, Aftertouch
- **Destinations**: Pitch (cents), Cutoff (Hz), Resonance, WavePos (morph), Volume, StereoWidth, Glide, FilterDrive
- **Processing**: per-sample, accumulates delta for each destination, applied after envelopes/LFOs
- **Route data**: trivially copyable, sent via BassCommand queue

---

## 3D Stereo Design

- **M/S matrix**: encode L+R → M and L-R → S, scale separately, decode
- **Width 0**: full mono (S = 0)
- **Width 1**: unprocessed stereo
- **Width 2**: extra-wide (side gain > 1.0)
- **Pan**: constant-power law, angle = (pan+1)/2 × π/2
- **HRTF**: framework prepared — filter chain position reserved, pass-through until Phase 7+
- **Binaural**: architecture allows HRTF convolution insertion between M/S and pan stages

---

## Thread Safety

| Operation | Thread |
|-----------|--------|
| `BassEngine::*` | UI Thread only |
| `BassNode::enqueueCommand()` | UI Thread → queue |
| `BassNode::process()` | Audio Thread |
| `BassNode::notifyGrooveTrigger()` | Audio Thread only |
| `BassNode::onTick / onBeat / onBar` | Audio Thread |
| `BassNode::activeVoiceCount()` | Any (atomic) |
| `BassNode::outputLevel()` | Any (atomic) |

---

## Groove Integration

Bass notes can originate from two paths:

1. **UI path**: `BassEngine::noteOn()` → `BassCommand::NoteOn` → queue → `BassVoicePool::noteOn()`
2. **Groove path** (sample-accurate): `GrooveNode::onTick()` → `BassNode::notifyGrooveTrigger()` — direct call on Audio Thread, bypasses queue, zero-latency

The Groove path is used when a GrooveEngine track is in Bass mode. Track mode flag routing is managed by GrooveEngine / BassEngine coordination at the UI layer.

---

## Known Limitations (Phase 5)

| Ref | Description | Severity | Planned Fix |
|-----|-------------|----------|-------------|
| B-01 | HRTF binaural processing not implemented | LOW | Phase 7+ |
| B-02 | Oversampling flag exists but 2×/4× path not implemented | LOW | Phase 6 |
| B-03 | S&H LFO is deterministic (not random) — no `rand()` on Audio Thread | LOW | Linear Congruential on AT if needed |
| B-04 | Custom0/Custom1 wavetable slots not populatable via JNI yet | LOW | Phase 6 API |
| B-05 | Ladder filter and SVF prepared in enum but not implemented | LOW | Phase 6 |
| B-06 | Per-voice voice state update logic in BassVoice.cpp simplified | LOW | Refine in Phase 6 |

---

## Consequences

- VibeCore 3D Bass is the reference implementation for all future instrument modules (Voice, Synth, Pad)
- All future instruments follow: `XxxNode : AudioNode` + `XxxEngine` (UI mirror) + `XxxCommand` queue
- No architectural additions needed until Phase 7 (FX graph integration)
- Architecture Freeze remains valid — Phase 5 is additive only

---

*ADR-007 — ACCEPTED — Phase 5 — VibeCore Univers SUPREMÉ*
