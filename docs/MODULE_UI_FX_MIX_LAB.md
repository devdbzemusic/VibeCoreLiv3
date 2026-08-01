# MODULE UI — FX MIX LAB

## Overview
FX Mix Lab presents the six FX bus channels as an accordion of vertical strips. Tapping a strip expands it to reveal its 6 parameters. Only one strip is expanded at a time. This enforces the 8-parameter rule: the collapsed view shows 3 read-only indicators per strip (type, level bar, meter), and the expanded view shows exactly 6 editable parameters (Mix, Boost, A, B, C, D).

---

## 3-Touch Access Map

| Touch | Action |
|-------|--------|
| 1 | Tap FX tab → FX Mix Lab page opens, 6 strips visible |
| 2 | Tap a strip → expands to show Mix, Boost, A, B, C, D controls |
| 3 | Drag a knob or slider → parameter changes immediately |

For bypass:
| Touch | Action |
|-------|--------|
| 1 | Tap FX tab → page opens |
| 2 | Tap the ⏻ Power button on any strip → bypasses/activates that bus |

---

## 8-Parameter Rule — Per-Expanded Strip

A strip, when expanded, exposes exactly 6 parameters:

| # | Parameter | Control | Store Path |
|---|-----------|---------|------------|
| 1 | Mix (wet/dry) | Range slider | `fx[slot].mix` |
| 2 | Boost | Range slider | `fx[slot].boost` |
| 3 | FX Param A | FxKnob | `fx[slot].params.A` |
| 4 | FX Param B | FxKnob | `fx[slot].params.B` |
| 5 | FX Param C | FxKnob | `fx[slot].params.C` |
| 6 | FX Param D | FxKnob | `fx[slot].params.D` |

The FX type picker is also shown when expanded — it is a selection, not a value parameter, so it does not count against the 8-parameter limit.

---

## Collapsed Strip Header

Each collapsed strip shows:
- **Slot letter** (A–F) — large, primary color when expanded
- **FX type** — truncated text label
- **Mini level meter** — live peak + RMS bar (updates at ≤10 Hz via useMeter)
- **Mix level bar** — shows current wet percentage
- **Bypass toggle** — ⏻ Power icon; active = neon-border; bypassed = 50% opacity
- **Clip LED** — red dot; latches for 1.5 s after a clip event

Tapping anywhere on the header except the bypass toggle expands/collapses the strip.

---

## Accordion Behavior

- Only one strip is expanded at a time
- Tapping the already-expanded strip closes it
- Tapping a different strip closes the current one and opens the new one
- Expanding adds `neon-border` to the panel

---

## AI Context Button

- Label: **AI Mix** (per expanded strip)
- Placement: inside each expanded strip's type-picker header
- Action: applies a subtle random Mix (20–80%) and Boost (0–30%) to that bus only
- Non-blocking; silent fail

---

## FxKnob Interaction

The FxKnob inside each expanded strip supports:
- **Vertical drag** — drag up to increase, down to decrease (200 px = full 0–100 sweep)
- **Long-press (500 ms)** → fine mode: 10× denser (2000 px equivalent), neon-amber ring indicator
- **Double-tap** → reset to default value (50)
- **Haptic**: 8 ms vibrate on entering fine mode (when `navigator.vibrate` available)

---

## Routing & Master Section

Collapsed by default behind the **ROUTING & MASTER** header. Contains:
- Serial / Parallel / Hybrid routing selector
- Shared Floor toggle (all slots share one calibrated noise floor vs. per-slot auto-calibration)
- Routing diagram (visual SVG-like layout of the 6 slots)
- Master output stereo meters (L/R peaks) + limiter gain reduction bar

---

## Live Meters

- `StripMiniMeter` subscribes only to `useMeter(s => s.fxPeaks[i])` — isolated re-render per strip
- `ClipLed` subscribes only to `useMeter(s => s.fxClip[i])` — isolated re-render
- Main `FxTab` component does NOT subscribe to the meter store — zero wasted re-renders on meter ticks

---

## Component Architecture

```
FxTab
├── Collapsible routing section
│   ├── Routing selector (serial/parallel/hybrid)
│   ├── Shared Floor toggle
│   ├── RoutingDiagram
│   └── MasterMeters
└── BusStrip ×6 (accordion)
    ├── Strip header (slot, type, StripMiniMeter, mix bar, bypass, ClipLed, chevron)
    └── [expanded] ExpandedStrip
        ├── AiContextButton ("AI Mix")
        ├── FX type picker
        ├── Mix slider
        ├── Boost slider
        └── FxKnob ×4 (A, B, C, D)
```

---

## Out of Scope

- Part-to-bus routing assignment (Task #2 — assigns which parts feed which buses)
- Per-part FX sends UI is in MixTab (part mixer)
- New DSP effect algorithms
- Side-chain routing
