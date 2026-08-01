# MODULE UI — 3D SYNTH

## Overview
The 3D Synth is the primary lead/pad synthesizer module. It presents an instrument-first layout: 8 macro parameters on large touch targets, with a secondary panel and deep editor accessible without abandoning the module.

---

## 3-Touch Access Map

| Touch | Action |
|-------|--------|
| 1 | Tap GRV tab → SYN sub-tab → 3D SYNTH page opens |
| 2 | Tap any macro knob → parameter changes immediately |
| 3 | Tap [◄] to open secondary panel → LFO, Detune, Width, Pan |

---

## 8-Parameter Rule — Primary Macros

| # | Parameter | Control | Store Path |
|---|-----------|---------|------------|
| 1 | Osc Shape | Cycling cell (tap to advance) | `part.synth3d.osc1.type` |
| 2 | Filter Cutoff | TactileKnob, 20–20000 Hz | `part.synth3d.filter1.freq` |
| 3 | Filter Resonance | TactileKnob, 0.1–20 Q | `part.synth3d.filter1.q` |
| 4 | Attack | TactileKnob, 1–5000 ms | `part.synth3d.ampEnv.attack` |
| 5 | Decay | TactileKnob, 1–5000 ms | `part.synth3d.ampEnv.decay` |
| 6 | Sustain | TactileKnob, 0–100% | `part.synth3d.ampEnv.sustain` |
| 7 | Release | TactileKnob, 10–8000 ms | `part.synth3d.ampEnv.release` |
| 8 | Reverb Send | TactileKnob, 0–100% | `part.sends[0]` |

---

## Secondary Panel

Opened by tapping the [◄] button in the macro header. Slides in from the right edge.
Dismissed by tapping [►] or tapping the backdrop.

| Parameter | Control | Store Path |
|-----------|---------|------------|
| LFO Rate | TactileKnob, 0.01–20 Hz | `part.synth3d.lfos[0].rate` |
| Detune | TactileKnob, 0–100 cents | `part.synth3d.unison.detune` |
| Drift | TactileKnob, 0–100 Hz | `part.synth3d.unison.drift` |
| Width | TactileKnob, 0–200% | `part.synth3d.spatial.width` |
| Pan | TactileKnob, L50–R50 | `part.synth3d.osc1.pan` |

---

## AI Context Button

- Label: **AI Optimize**
- Placement: macro panel header, right side
- Action: applies a randomized oscillator type + filter frequency variation
- Non-blocking: completes asynchronously; audio continues uninterrupted
- Silent fail: errors are discarded; the button returns to idle state

---

## Deep Editor

- Collapsed by default to enforce the 8-parameter rule
- Expanded by tapping **DEEP EDITOR** collapsible at the bottom of the page
- Contains the full `Synth3DSubtab` workflow: SOUND → OSC → FILTER → ENV → 3D → FX → SAVE
- All changes in the deep editor write to the same store path and are immediately audible

---

## Component Architecture

```
Synth3DPage
├── Voice picker strip (horizontal scroll)
├── Macro panel (panel)
│   ├── OscShapeCell ×1 (cycling touch button)
│   ├── TactileKnob ×7 (Cutoff, Reso, A/D/S/R, Reverb)
│   └── AiContextButton ("AI Optimize")
├── [◄] SecondaryPanel (absolute, slide-in from right)
│   └── TactileKnob ×5 (LFO Rate, Detune, Drift, Width, Pan)
└── Collapsible deep editor
    └── Synth3DSubtab (SOUND → SAVE workflow)
```

---

## Out of Scope

- New DSP oscillator modes (audio engine only)
- Real-time modulation visualization
- MIDI CC assignment (Task #3)
- Per-macro scene automation (Task #11)
