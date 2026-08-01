# 08 — Groove (Performance-Core)

> Phase/Doc 08 · Status: Draft v1.0 · Owner: Senior Audio Director + Senior UX Architect · Review: 15-Rollen, 2/3-Mehrheit

## 1. Vision
Phase 6 ist das **Alleinstellungsmerkmal**. Der Groove-Core macht Timing zur ersten Bürgerin: Swing, Humanize, Ratchets, Probability, Polyrhythmik und grid-aligned Scene-Switching — alles sync-konsistent und ohne Dropout spielbar.

## 2. Step-Engine
- 16th-Grid (Default), pro Szene `length ∈ {4,8,16}` (Pattern-Domain).
- Step-Felder: `on`, `velocity`, `probability`, `gate`, `ratchet`, `micro`, `accent`, `condition`, `pitch`, `humanize`.
- Scheduler: Look-ahead auf `AudioContext.currentTime`/Gerätezeit; **grid-aligned Pattern-Switch** (kein Flam).
- Quantisierung & Swing parametrisierbar; Humanize über deterministische RNG (seed) — reproduzierbar.

## 3. Piano Roll
- Noten (`schemas/scene.schema.json`): `step`, `pitch` (MIDI), `length` (in 16th), `velocity`, `micro`.
- Quantize-Funktion (Grid 1..N); Polymetrik zwischen Szenen erlaubt.

## 4. Motion Sequencer
- Parameter-Automation als First-Class Modulationsquelle (snap to ParamTable).
- CC-/Pitchbend-Lanes; nicht-destruktiv.

## 5. Live-Performance
- **Scene-Switching:** grid-aligned, ohne Master-Duck, ohne Flam; Queued-Pattern wird am Takt-Anfang übernommen.
- **Performance-Pads:** One-tap-Trigger, Velocity-sensitive.
- **Co-Assistent (AI):** schlägt Groove/Melodie vor, **konsultiert nur die Sync-Engine** (keine eigene Uhr) — siehe `12_AI.md`.

## 6. CPU-Budget
- Step-Engine + Piano-Roll ≤ 2 %; Scene-Switch-Splice ohne额外 Headroom-Reserve nötig (vorallokierter Pattern-Speicher).

## 7. Tests
- `tests/realtime`: 60 s Live-Playback + Scene-Switch alle 4 Takte, Dropout = 0.
- `tests/regression`: Groove-Referenz-Patterns (Swing/Humanize) audiovergleich.
- Sync-Konsistenz: Step-Index = Sync `beat*4 % length`.