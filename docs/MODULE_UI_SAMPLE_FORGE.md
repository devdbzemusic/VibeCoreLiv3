# MODULE UI — SAMPLE FORGE

## Overview
Sample Forge is the sample editing and manipulation module. Its defining layout principle: **the waveform is the UI**. The waveform occupies at minimum 60% of visible screen height. All editing actions live in a scrollable horizontal toolbar directly below the waveform — no menus, no nested panels required.

---

## 3-Touch Access Map

| Touch | Action |
|-------|--------|
| 1 | Tap FRG tab → Sample Forge page opens with waveform visible |
| 2 | Drag the S or E handle → set start or end point |
| 3 | Tap any toolbar action → applied immediately to buffer |

For slicing:
| Touch | Action |
|-------|--------|
| 1 | Tap SLICES count (2/4/8/16/32/64) → dividers appear on waveform |
| 2 | Drag a slice divider → reposition slice boundary |
| 3 | Tap a slice pad → audition that slice |

---

## Waveform Surface

- **Height**: `min-h-[280px] h-[52vh]` — fills most of the viewport
- **Start marker (S)**: draggable handle, primary color, left boundary
- **End marker (E)**: draggable handle, neon-magenta, right boundary
- **Interior slice dividers**: draggable amber handles (appear when slices > 1)
  - Positions stored in local component state as normalized 0..1 values
  - Initialized from even divisions of `wave.slices`
  - Constrained: each divider stays between its neighbors ± 0.01
- **Dimmed regions**: areas outside S/E are 70% opaque overlay
- **Busy overlay**: while DSP is running, a full-canvas spinner replaces the waveform

---

## Horizontal Action Toolbar

Scrollable, no line wrap. Each action is a 44×44 px touch target with icon + label.

| Action | Icon | Color | Effect |
|--------|------|-------|--------|
| PLAY | Play | primary | Preview current buffer from S to E |
| ASSIGN | Wand | neon-lime | Assign browser selection to current part |
| NORM | Volume2 | neon-lime | Normalize buffer amplitude to 0 dBFS |
| REV | Rewind | neon-amber | Reverse buffer in place |
| TRIM | Crop | primary | Destructively trim buffer to S/E region |
| FADE | Wand | neon-lime | Apply fade-in/fade-out from wave settings |
| PITCH | Music2 | neon-magenta | Pitch-shift by `wave.pitchShift` semitones |
| STR% | Clock | neon-cyan | Time-stretch by `wave.timeStretch`% |
| SPEC FRZ | Snowflake | neon-cyan | Spectral freeze at `wave.freezePos` |
| TRIGGER | Play | neon-cyan | Trigger the assigned part buffer directly |
| EXP | Download | neon-cyan | Export this part's wave preset as JSON |
| EXP ALL | Download | neon-cyan | Export all 16 parts' wave presets as JSON |
| IMP PRE | FileUp | neon-lime | Import a saved wave preset JSON |

---

## AI Context Button

- Label: **Auto Slice**
- Placement: waveform header, right side (next to IMPORT)
- Action: calls `autoChopBuffer()` to detect transients; sets `wave.slices` to the nearest supported count (2/4/8/16)
- Non-blocking; shows spinner while running

---

## Toggle Row

Below the toolbar, three always-visible toggle buttons:

| Button | State | Store Path |
|--------|-------|------------|
| REVERSE | on/off | `wave.reverse` |
| LOOP | on/off | `wave.loop` |
| FREEZE | on/off | `wave.freeze` (also forces loop=true) |

---

## Slices Section

- Slice count selector: pills for 2 / 4 / 8 / 16 / 32 / 64
- Slice trigger pads: tap to audition each slice using custom `slicePositions` state
- Slice positions in local state: initialized on `wave.slices` change; dividers on waveform match

---

## Collapsible Sections

To enforce the 3-touch rule, the less-frequently-used sections are collapsible:

- **SAMPLE BROWSER** — collapsed by default; shows loaded samples + IMPORT button
- **PART ASSIGNMENTS** — collapsed by default; shows 16-part grid for part selection

---

## Component Architecture

```
SmplTab
├── Waveform editor panel (primary, tall)
│   ├── Compact header (part name, sample name, AiContextButton, IMPORT)
│   ├── Waveform canvas (h-[52vh], interactive)
│   │   ├── Waveform bars (wavePeaks memo)
│   │   ├── Dimmed S/E regions
│   │   ├── Interior slice dividers (draggable)
│   │   └── S / E handles (draggable)
│   ├── Start / End sliders (compact)
│   ├── Horizontal action toolbar (scrollable)
│   └── Toggle row (REVERSE / LOOP / FREEZE)
├── Slices panel
│   ├── Count selector
│   └── Slice pads grid
├── Sample Browser (collapsible)
└── Part Assignments (collapsible)
```

---

## Out of Scope

- Granular synthesis editor (accessible via ForgeTab sub-tab elsewhere)
- Spectral display / FFT visualization
- Multi-sample layering / round-robin
- MIDI note-to-sample mapping
