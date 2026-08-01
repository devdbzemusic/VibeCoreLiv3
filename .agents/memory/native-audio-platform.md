---
name: VibeCore Native Audio Platform Architecture
description: 10-MASTERPROMPT series defining the Oboe-based native Android audio platform. Implementation order: Oboe Core → Sync → Groove → Synth → Bass → FX Lab → Forge → Voice → AI → Brainwavez → Remix. ONE engine, all modules share it.
---

# VibeCore Native Audio Platform — Agent Reference

## Core Invariant
ONE Oboe engine. Every module (Groove/Synth/Bass/FX/Voice/AI/Brainwavez) uses it.
Never build a second audio engine for any module. Never add timers to modules — all timing from VibeCore Sync.

## Existing Native Base (native-android/)
Already implemented:
- vibecore_engine.h/.cpp — Oboe AAudio stream + OpenSL ES fallback
- 48 kHz · 96 frames/burst · Float32 Stereo
- 64-voice sample mixer (trigger-based)
- ADPF hints (Android 12+) · Big-core CPU affinity

Gap: no DSP Core, no Bus Routing, no Sync layer, no module integrations.
MASTERPROMPT 1 starts from this base and builds upward.

## Audio Callback Rules (realtime safety — non-negotiable)
NO allocations · NO logging · NO file I/O · NO UI · NO locks
Only: mixing + DSP + output

## Audio Parameters
48 kHz · 96 frames · AAudio preferred · OpenSL ES fallback · Float32 · Stereo

## Implementation Order (strict — no skipping)
1. Oboe Core Engine (MASTERPROMPT 1) — foundation
2. VibeCore Sync (MASTERPROMPT 2) — master clock, PPQ 1920, <0.5 ms jitter
3. Groove (MASTERPROMPT 3) — 15 drum tracks, piano roll, pattern chain
4. Synth (MASTERPROMPT 4) — 4-voice paraphonic, mod matrix, presets
5. Bass (MASTERPROMPT 5) — mono legato, slide, drive, Techno-optimized
6. FX Lab (MASTERPROMPT 6) — DSP nodes, bus routing, spatial matrix (creative tool only — no medical claims)
7. Sample Forge (MASTERPROMPT 7) — streaming, no load pauses, slice/stretch/detect
8. Voice (MASTERPROMPT 8) — recording, formant, granular, looper
9. AI (MASTERPROMPT 9 in doc = Brainwavez; MP 10 = AI) — analysis + suggestions only, never controls DSP
10. Brainwavez — binaural/isochronic generator, safety limits, technical feature only (no therapeutic claims)
11. Remix — scene chain, performance controls

## Acceptance Criteria (Engine must pass ALL before any module work)
- Zero XRuns · zero glitches · zero allocations in callback
- Stable 48 kHz · total latency < 10 ms

## Brainwavez / FX Spatial — Legal Boundary
Binaural processing = technical audio feature.
Possible psychological/neurological effects = open research domain.
Never communicated as a guaranteed outcome. Safety limits required.

## Full document
`NATIVE_AUDIO_PLATFORM.md` in project root.
