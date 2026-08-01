# ARP Module UI Spec

## Overview
The ARP module is the shared SceneStep arpeggiator that feeds Bass, 3D Synth, and later modules. It is performance-first: one touch to enable, one touch to change mode.

## 3-Touch Access
| Touch | Action |
|-------|--------|
| 1 | Tap the large ON/OFF button (enable/disable ARP) |
| 2 | Tap MODE cell to cycle through 8 modes (UP/DOWN/UPDOWN/RANDOM/CHORD/SPIRAL/ORBIT/DNA) |
| 3 | Toggle any gate step cell in the 16-step grid |

## 8-Parameter Rule
All 8 parameters are visible simultaneously in a 4×2 TactileKnob grid:

| # | Label | Mapping | Range |
|---|-------|---------|-------|
| 1 | MODE | `arp.mode` — cycling cell | UP/DOWN/UPDOWN/RANDOM/CHORD/SPIRAL/ORBIT/DNA |
| 2 | RATE | `arp.complexity` | 0–100 |
| 3 | GATE | `arp.vibeControl` | 0–100 |
| 4 | OCTAVE | `arp.octaves` | 1–4 |
| 5 | ROOT | `arp.rootNote` | MIDI 24–60 (C1–C4) |
| 6 | SCALE | `arp.scale` — cycling cell | minor/major/phrygian/minorPent/majorPent |
| 7 | SWING | local UI state | 0–100% (pending engine wiring) |
| 8 | CHANCE | local UI state | 0–100% (pending engine wiring) |

## Beat-Sync Pulse
- 4 quarter-note indicator dots in the header track `playheads.step`
- The active beat dot scales up + glows (`scale-125 shadow-glow-primary`) for ~100ms
- No JavaScript timer — purely reactive to store's `playheads.step` changes

## HOLD Mode
Separate 3-button row below the knob grid:
- **HOLD** (maps to ArpState "Clean") — sustains notes
- **SMART** (maps to "Smart") — intelligent gate management
- **FREE** (maps to "Hard") — tight gate chop

## 16-Step Gate Grid
- 2×8 grid of step cells
- Accent markers on every 4th step (beat 1 of each bar)
- Active step highlighted with `ring-1 ring-primary`
- ALL / CLR quick-fill buttons

## AI Action
`AiContextButton` label "AI Arp" — randomizes mode + gate pattern + complexity.
Logs to `aiHistory` as "Generated arp pattern" from module "ARP".

## Files
- `src/components/groovebox/ArpPanel.tsx`
- `src/lib/audio/arpEngine.ts` — ArpConfig type, ARP_MODES, ARP_SCALES, ARP_STATES
