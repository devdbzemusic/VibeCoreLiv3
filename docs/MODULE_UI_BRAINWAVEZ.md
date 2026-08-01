# bRAINWAVEz Module UI Spec

## Overview
Immersive fullscreen brainwave entrainment surface. The animated visualization fills the entire module background. 8 TactileKnob controls are overlaid. All animations use `transform`/`opacity` only — never `width`, `height`, or `top`/`left` during animation (GPU-composited only).

## 3-Touch Access
| Touch | Action |
|-------|--------|
| 1 | Tap ENGINE ON/OFF button (large power icon) |
| 2 | Tap a preset button (applies coordinated carrier + beat + mode preset) |
| 3 | Adjust any TactileKnob (rotate to change parameter) |

## Layout
All panels have `background: rgba(10,12,20,0.75)` + `backdrop-blur-sm` so the animated background shows through.

### Panel 1: Master + Presets
- ENGINE ON/OFF button (48×48px, neon-lime when active)
- Mode pills: BIN / ISO / PHASE
- Clock mode pills: FREE / SYNC / HYBRID
- Horizontal-scroll preset strip (one button per BRAINWAVE_PRESETS key)

### Panel 2: 8 Controls (4 + 4 layout)
**PRIMARY (4)**
| # | Label | API setter | Range |
|---|-------|-----------|-------|
| 1 | BASE FREQ | `setBrainwaveCarrier(v)` | 20–2000 Hz |
| 2 | BI OFFSET | `setBrainwaveBeat(v)` | 0.1–50 Hz |
| 3 | TEXTURE | `setBrainwaveIsoRate(v)` | 0.1–60 Hz |
| 4 | MOD DEPTH | `setBrainwaveMix(v/100)` | 0–100% |

**ATMOSPHERE (4)**
| # | Label | API setter | Range |
|---|-------|-----------|-------|
| 5 | NOISE CLR | `setSolfeggioGain(v/100)` | 0–100% |
| 6 | FADE RATE | `setBrainwavePhaseRate(v)` | 0.05–8 Hz |
| 7 | SPATIAL W | `setSolfeggioQ(v)` | Q 1–60 |
| 8 | VOLUME | `setBrainwaveMix(v/100)` | 0–100% |

### Panel 3: Solfeggio Resonators
Horizontal flex-wrap of toggle buttons for each `SOLFEGGIO_FREQS` frequency.

## Background Animation
- **Scan lines** (12 horizontal): gradient bands with staggered `animationDuration` and `animationDelay`, `animationName: "pulse"` — Tailwind's built-in keyframe (opacity only)
- **Vertical accent bars** (6): similar treatment
- **Waveform bars at bottom** (40): varying heights from `Math.abs(Math.sin(i * 0.45))`, same pulse animation
- Mode color: binaural=cyan, isochronic=magenta, phase=lime — changes via CSS `background` transition (not animation)
- Enabled vs disabled: opacity values change via inline style `(enabled ? 0.18 : 0.06)` on backgrounds
- All transform/opacity animations are GPU-composited; no layout-triggering properties animate

## Files
- `src/components/groovebox/BrainwaveTab.tsx`
- `src/lib/audio/brainwave.ts` — all setter functions
