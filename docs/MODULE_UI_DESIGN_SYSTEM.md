# VibeCore LIV3 — Module UI Design System

**Version:** 1.0  
**Authority:** This document is the canonical reference for all module UI development.  
Every new module, component, and UI element must conform to these specifications.

---

## 1. Design Philosophy

VibeCore LIV3 must feel like a professional music instrument, not software. The design system enforces three principles:

1. **Instrument first** — Controls behave like hardware. Touch targets are large, interactions are immediate, feedback is tactile and visual.
2. **3-touch rule** — Any parameter must be reachable within 3 taps from anywhere in the app.
3. **8-parameter rule** — No module screen shows more than 8 primary parameters at once. Overflow is handled by sub-sections, not by cramming.

---

## 2. Color System

All colors are defined as HSL CSS custom properties in `src/index.css`. **Never hardcode hex or RGB values.**

### Core Surfaces

| Token | Value | Usage |
|---|---|---|
| `--background` | `222 47% 4%` | App background |
| `--surface-0` | `222 47% 4%` | Deepest inset (inputs) |
| `--surface-1` | `220 40% 7%` | Panel background |
| `--surface-2` | `218 38% 10%` | Elevated panel |
| `--surface-3` | `216 36% 14%` | Interactive hover |
| `--surface-elev` | `214 34% 18%` | Floating elements |

### Semantic Accent Colors

| Token | Tailwind class | Role | **Restriction** |
|---|---|---|---|
| `--primary` (cyan) | `text-primary` | Default accent, active states | — |
| `--cyan` | `text-neon-cyan` | Secondary accent, info | — |
| `--crimson` | `text-neon-crimson` | **Record only** | Never use for general UI |
| `--lime` | `text-neon-lime` | **Playing/active state only** | — |
| `--amber` | `text-neon-amber` | **Warnings only** | Never use for active states |
| `--magenta` | `text-neon-magenta` | Accent variation | — |
| `--violet` | `text-neon-violet` | Synth / creative accents | — |

**Color contract (never violate):**
- 🔴 Red / crimson → Record, error, clip
- 🟢 Green / lime → Active, playing, OK
- 🟡 Amber → Warning only
- 🔵 Cyan / blue → Primary accent, controls

### Gradients

| Token | Usage |
|---|---|
| `--gradient-primary` | Primary action buttons |
| `--gradient-accent` | Secondary accent fills |
| `--gradient-surface` | Header/nav backgrounds |
| `--gradient-panel` | Panel backgrounds |

---

## 3. Typography

Two display faces + one mono face. **Never use system-ui for labels or data.**

| Variable | Face | Usage |
|---|---|---|
| `--font-display` | Orbitron | Module names, BPM, parameter values, headings |
| `--font-mono` | JetBrains Mono | Labels, units, status text, step counts |
| `--font-body` | Inter | Descriptive text, tooltips, long-form content |

### Type Scale

| Class | Size | Usage |
|---|---|---|
| `font-display text-3xl` | 30px | Hero BPM display |
| `font-display text-xl` | 20px | Module name hero |
| `font-display text-sm` | 14px | Panel headings |
| `font-display text-[11px]` | 11px | Section labels |
| `font-display text-[9px]` | 9px | Sub-labels, badges |
| `font-mono text-[10px]` | 10px | Value readouts |
| `font-mono text-[9px]` | 9px | Status, units |
| `font-mono text-[8px]` | 8px | Micro labels |
| `font-mono text-[7px]` | 7px | Axis labels, dense data |

---

## 4. Spacing Scale

All spacing uses the 4-pt grid defined in `--space-*` tokens.

| Token | Value | Tailwind equivalent |
|---|---|---|
| `--space-1` | 4px | `p-1`, `gap-1` |
| `--space-2` | 8px | `p-2`, `gap-2` |
| `--space-3` | 12px | `p-3`, `gap-3` |
| `--space-4` | 16px | `p-4`, `gap-4` |
| `--space-6` | 24px | `p-6`, `gap-6` |
| `--space-8` | 32px | `p-8`, `gap-8` |

---

## 5. Touch Targets

All interactive elements must meet these minimum sizes:

| Context | Minimum size |
|---|---|
| Module nav items | 44 × 44 px |
| Transport buttons | 44 × 44 px |
| Tactile knobs | 44 × 44 px (`size="sm"`) |
| Tactile sliders (track touch area) | 44 px in hit axis |
| Tactile pads | 44 × 44 px (`size="sm"`) |
| Settings toggles / pills | 36 × 36 px (acceptable for dense settings UI) |

**Never** put an interactive element with a touch target below 32 px.

---

## 6. Elevation & Shadows

| Token | Usage |
|---|---|
| `--shadow-sm` | Inline badges, small chips |
| `--shadow-md` | Panels, cards |
| `--shadow-lg` | Floating panels, modals |
| `--shadow-xl` | Overlay modals |
| `--glow-primary` | Active primary controls |
| `--glow-accent` | Active accent controls |
| `--glow-soft` | General panel ambient |
| `--inset-glow` | Hardware surface illusion |

---

## 7. Animation

| Token | Value | Usage |
|---|---|---|
| `--ease-snappy` | `cubic-bezier(0.2, 0, 0, 1)` | UI element transitions |
| `--ease-spring` | `cubic-bezier(0.2, 0.9, 0.3, 1.2)` | Entrance animations, knob snap |
| `--ease-out` | `cubic-bezier(0, 0, 0.3, 1)` | Exit animations |

### Standard Durations

| Context | Duration |
|---|---|
| Button press feedback | 75–100 ms |
| Tab / module transition | 200–250 ms |
| Panel slide-in | 250–300 ms |
| LED / glow pulse | 1.2 s |
| Beat pulse | 500 ms |

### Animation Classes

| Class | Behavior |
|---|---|
| `animate-slide-up` | Entrance: translate Y + fade in |
| `animate-pulse-neon` | Continuous neon glow pulse (record, active sync) |
| `animate-beat-pulse` | Scale pulse on BPM beat |

---

## 8. CSS Component Classes

Defined in `src/index.css` `@layer components`. Use these — never reinvent.

| Class | Purpose |
|---|---|
| `.panel` | Standard module card / container |
| `.panel-inset` | Inset control surface (inputs, sliders, LCD reads) |
| `.hw-screen` | LCD-style display screen |
| `.hw-bezel` | Hardware panel with corner brackets |
| `.hw-led` | Tiny status LED (use `data-on`, `data-tone` attributes) |
| `.hw-divider` | Neon tri-color brushed-metal divider line |
| `.tab-pill` | Navigation pill (module nav, sub-tabs) |
| `.neon-text` | Glowing neon primary text |
| `.neon-border` | Glowing neon border |
| `.step-cell` | Sequencer step cell (use `data-active`, `data-playing`, `data-accent`) |
| `.pad` | Drum pad / trigger pad |
| `.ring-knob` | Metallic knob body for TactileKnob |
| `.glow-dot` | Small glow indicator dot |
| `.hairline` | Neon divider line |
| `.scanline` | CRT scanline overlay effect |
| `.no-scrollbar` | Hide scrollbar (touch panels) |

---

## 9. Mobile Performance Rules

The app must render at ≥60 FPS on a mid-range Android phone. These rules are enforced via CSS media query at `(max-width: 768px), (pointer: coarse)`:

- `backdrop-filter` disabled (too expensive on mobile GPU)
- Body background simplified to flat `hsl(var(--background))`
- `.panel` shadow reduced
- `.neon-border` shadow reduced
- `.hw-bezel` decorative `::after` hidden
- `.neon-text` text-shadow disabled

**Code rules:**
- Never use `box-shadow` with > 2 layers in hot-path components
- Never trigger layout in audio callbacks
- Use `will-change: transform` only on elements that animate > 1 Hz
- Prefer `transform` + `opacity` for animations (compositor-only)

---

## 10. Module Layout Contract

Every module page must follow this vertical stack:

```
┌──────────────────────────────────────────┐
│  TopBar (global, always visible)         │
├──────────────────────────────────────────┤
│  ModuleHeader (module name · BPM ·       │
│    transport · pattern · scene · sync)   │
├──────────────────────────────────────────┤
│  Module content                          │
│  (scrollable, pb-24 for nav clearance)   │
├──────────────────────────────────────────┤
│  TabBar / ModuleNav (12 modules)         │
└──────────────────────────────────────────┘
```

**ModuleHeader is rendered automatically** by the `<ModulePage>` wrapper in `src/pages/Index.tsx`. Module components do not render their own header. Exception: the HOME module has a custom hero layout and no ModuleHeader.
