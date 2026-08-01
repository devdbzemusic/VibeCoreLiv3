# MODULE UI — 3D BASS

## Overview
The 3D Bass module is a dedicated bass synthesizer. Its primary surface consists of six full-width horizontal sliders for the core bass parameters, a dedicated Portamento/Glide section, and a one-touch link to the Piano Roll for the selected bass part.

---

## 3-Touch Access Map

| Touch | Action |
|-------|--------|
| 1 | Tap BAS tab → 3D BASS page opens |
| 2 | Drag any slider → parameter changes immediately |
| 3 | Tap **PIANO ROLL · {name}** button → navigates to GROOVE/ROLL with this part selected |

---

## 8-Parameter Rule — Primary Controls

The 5 core sliders + Portamento Glide slider together constitute 6 parameters. The Glide section also adds a Mode picker (Poly / Mono / Legato), for a total of 7 surface parameters. The AI Bassline button is a meta-action, not counted as a parameter.

| # | Parameter | Control | Store Path |
|---|-----------|---------|------------|
| 1 | Sub Level | TactileSlider, 0–100% | `part.bass3d.sub.level` |
| 2 | Punch | TactileSlider, 0–100% | `part.bass3d.dynamics.bassPunch.amount` |
| 3 | Drive | TactileSlider, 0–200% | `part.bass3d.drive.amount` |
| 4 | Filter Cutoff | TactileSlider, 20–20000 Hz (log) | `part.bass3d.filter1.freq` |
| 5 | Stereo Width | TactileSlider, 0–200% | `part.bass3d.spatial.width` |
| 6 | Glide Time | TactileSlider, 0–2000 ms | `part.bass3d.performance.glideTime` |
| 7 | Play Mode | Segmented button (Poly/Mono/Legato) | `part.bass3d.performance.mode` |

---

## Filter Display Scale

The Filter slider maps linearly to a logarithmic frequency scale (20 Hz → 20 kHz) so that the musically useful mid-range (200 Hz–4 kHz) occupies a larger visual region of the slider travel.

Formula: `freq = 20 × 1000^(sliderValue/100)`

---

## One-Touch Piano Roll Access

A button in the primary surface reads **PIANO ROLL · {partName}**. Tapping it:
1. Calls `selectPart(p.id)` to set the active part in the store
2. Calls `setTab("ROLL")` to navigate to the GROOVE Piano Roll
3. The Piano Roll opens with this bass part selected and its notes visible

---

## AI Context Button

- Label: **AI Bassline**
- Placement: core section header, right side
- Action: generates a minor pentatonic bassline at 36 MIDI (bass register) for the current scene length using `buildMelody()`; writes notes via `setNotes()`
- Non-blocking; does not interrupt playback

---

## Deep Editor

- Collapsed by default
- Contains the full `Bass3DSubtab` workflow: SOUND → OSC → FILTER → DRIVE → DYN → ENV → SPACE → FX → SAVE
- All sub-tab edits write to `part.bass3d` and are immediately audible

---

## Component Architecture

```
Bass3DPage
├── Voice picker strip (horizontal scroll)
├── Core parameter panel (panel)
│   ├── ParamSlider ×5 (Sub, Punch, Drive, Filter, Width)
│   └── AiContextButton ("AI Bassline")
├── Portamento / Glide panel (panel)
│   ├── ParamSlider (Glide)
│   └── Mode segmented buttons (Poly/Mono/Legato)
├── Piano Roll routing button (full-width)
└── Collapsible deep editor
    └── Bass3DSubtab (SOUND → SAVE workflow)
```

---

## Out of Scope

- New DSP drive algorithms (audio engine only)
- Sub-only mono crossover configuration (accessible via SPACE step in deep editor)
- MIDI CC assignment (Task #3)
- Bus routing (Task #2)
