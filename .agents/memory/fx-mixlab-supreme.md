---
name: VibeCore FX MIX LAB SUPREMÉ
description: Architecture Board v1.0 — FX MIX LAB is the central live performance hub. 5 sub-tabs: MIX · FX · PERFORM · REMIX · 3D MATRIX. REMIX is NOT a separate module — fully absorbed into FX MIX LAB. No own audio engine; uses Oboe + DSP Core + VibeCore Sync exclusively.
---

# FX MIX LAB SUPREMÉ — Agent Reference

## Critical Structural Rule
REMIX is NOT a standalone module. It lives INSIDE FX MIX LAB as the 4th sub-tab.
Never create a separate REMIX tab at the top-level navigation.

## FX MIX LAB Sub-Tab Structure (5 tabs)
```
MIX     → Channel strips · bus routing · meters · limiter · analyzer
FX      → DSP nodes: EQ · Comp · Limiter · Gate · Sat · Dist · Bit · Chorus · Flanger · Phaser · Delay · Reverb · Freeze · Pitch · Grain · Filter · Resonator · Stereo Widener · Binaural
PERFORM → XY Pad · Dual XY · Macro Controls · Morph Engine · Motion Recording · Crossfader · Ribbon · Randomizer · Humanizer
REMIX   → Beat Repeat · Roll · Reverse · Tape Stop · Stutter · Glitch · Live Looper · Slice Trigger · Buffer Freeze · Live Resampling
3D MTX  → Psychoacoustic spatial matrix: L↔R · Front↔Back · Height · Width · Depth · Focus · Motion · Diffusion · Air · Presence — creative tool, NO therapeutic claims
```

## TabKey Mapping
- MIX     → TabKey "MIX"
- FX      → TabKey "FX"
- PERFORM → TabKey "PERF" (repurposed from standalone REMIX sub-tab)
- REMIX   → TabKey "REMIX" (repurposed from standalone REMIX primary)
- 3D MTX  → TabKey "PROD" (repurposed from standalone PROD/production tab)

## Oboe Integration Rule
FX MIX LAB has NO own audio engine, NO own scheduler, NO own clock.
Uses exclusively: Oboe + DSP Core + Audio Graph + VibeCore Sync + Bus Routing.

## DSP Signal Flow
Track → Insert FX → Channel Strip → Bus Routing → Send FX → REMIX Engine → 3D Matrix → Master Bus → Limiter → Audio Output

## UI Rules
One Regler = One Function · No hidden menus · No popups · No nested dialogs · No dual-use controls
Five Second Rule: max 5s from open to first live performance action.

## Performance Targets
60 FPS UI · zero XRuns · zero glitches · zero heap allocs in audio thread · deterministic DSP

## Full document
`FX_MIXLAB_SUPREME.md` in project root.
