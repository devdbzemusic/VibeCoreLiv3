# VibeCore LIV3 — Module UI Component Library

**Version:** 1.0  
**Import path:** `@/components/controls`  
**Authority:** These are the canonical touch controls for all module UIs. Do not create alternative knob/slider/pad/button implementations.

---

## Overview

All four canonical controls live in `src/components/controls/`:

```
src/components/controls/
├── TactileKnob.tsx     — Circular drag knob
├── TactileSlider.tsx   — Horizontal / vertical slider
├── TactilePad.tsx      — Velocity-sensitive drum pad / trigger
├── TactileButton.tsx   — Touch button (5 variants)
└── index.ts            — Re-exports all four + their prop types
```

Import pattern:
```tsx
import { TactileKnob, TactileSlider, TactilePad, TactileButton } from "@/components/controls";
```

---

## TactileKnob

Circular rotary control. Maps drag distance to value — drag up to increase, down to decrease.

### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `value` | `number` | required | Current value (in `min`..`max` range) |
| `min` | `number` | `0` | Minimum value |
| `max` | `number` | `1` | Maximum value |
| `onChange` | `(v: number) => void` | required | Called on every drag tick |
| `defaultValue` | `number` | — | Double-tap resets to this value |
| `label` | `string` | — | Label shown below the knob |
| `display` | `string` | — | Overrides the auto-generated value readout |
| `size` | `"sm" \| "md" \| "lg"` | `"md"` | sm=44px, md=56px, lg=72px |
| `color` | `"cyan" \| "magenta" \| "amber" \| "lime"` | `"cyan"` | Arc fill color |
| `disabled` | `boolean` | `false` | Disables interaction, dims visually |
| `className` | `string` | — | Additional Tailwind classes |

### Interactions

| Gesture | Behavior |
|---|---|
| Vertical drag | ±value (120 px = full range) |
| Drag + Shift | Fine mode (1200 px = full range) |
| Scroll wheel | Fine adjustment |
| Double-tap | Reset to `defaultValue` |

### Example

```tsx
<TactileKnob
  value={filterCutoff}
  min={20} max={20000}
  onChange={(v) => setFilterCutoff(v)}
  defaultValue={1000}
  label="CUTOFF"
  display={`${Math.round(filterCutoff)}Hz`}
  size="md"
  color="cyan"
/>
```

---

## TactileSlider

Linear slider. Supports horizontal and vertical orientations.

### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `value` | `number` | required | Current value |
| `min` | `number` | `0` | Minimum value |
| `max` | `number` | `1` | Maximum value |
| `step` | `number` | — | Snap to steps (optional) |
| `onChange` | `(v: number) => void` | required | Called on drag |
| `label` | `string` | — | Label + value readout |
| `display` | `string` | — | Override value display string |
| `orientation` | `"horizontal" \| "vertical"` | `"horizontal"` | Track orientation |
| `trackSize` | `number` | `6` | Visual track thickness (px) |
| `color` | `"cyan" \| "magenta" \| "amber" \| "lime"` | `"cyan"` | Fill color |
| `disabled` | `boolean` | `false` | Disables interaction |
| `className` | `string` | — | Additional classes |

### Touch target

The click/drag area is always padded to ≥44 px in the interaction axis regardless of `trackSize`.

### Example

```tsx
<TactileSlider
  value={volume}
  min={0} max={100}
  onChange={setVolume}
  label="VOLUME"
  display={`${Math.round(volume)}%`}
  color="cyan"
/>
```

---

## TactilePad

Velocity-sensitive pad for drums, triggers, and step cells.

### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `active` | `boolean` | `false` | Shows "on" visual state (e.g. step enabled) |
| `onPress` | `(velocity: number) => void` | — | Called on pointerdown; velocity 0..1 from pointer pressure |
| `onRelease` | `() => void` | — | Called on pointerup/cancel |
| `label` | `string` | — | Centered label inside the pad |
| `badge` | `string \| number` | — | Small badge in the top-left corner (e.g. step number) |
| `color` | `"cyan" \| "magenta" \| "amber" \| "lime" \| "crimson"` | `"cyan"` | Active glow color |
| `size` | `"sm" \| "md" \| "lg"` | `"md"` | sm=44px, md=64px, lg=88px |
| `disabled` | `boolean` | `false` | Disables interaction |
| `className` | `string` | — | Additional classes |

### Velocity

On platforms supporting the Pointer Events pressure API, `velocity` is `e.pressure` (0..1). On platforms where pressure is not available, it defaults to `0.8`.

### Example

```tsx
// Sequencer step cell
<TactilePad
  active={step.on}
  badge={stepIndex + 1}
  onPress={(vel) => toggleStep(partId, stepIndex)}
  color="cyan"
  size="sm"
/>

// Drum pad
<TactilePad
  onPress={(vel) => triggerDrum(padId, vel)}
  label="KICK"
  color="crimson"
  size="lg"
/>
```

---

## TactileButton

Hardware-style touch button with five semantic variants.

### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `label` | `string` | required | Button text (also used as aria-label if `aria-label` not set) |
| `onClick` | `() => void` | required | Click / tap handler |
| `variant` | `"default" \| "primary" \| "active" \| "record" \| "danger"` | `"default"` | Visual variant |
| `icon` | `React.ReactNode` | — | Icon shown left of label |
| `active` | `boolean` | `false` | Toggle state (auto-applies `"active"` variant styling to `"default"` buttons) |
| `disabled` | `boolean` | `false` | Disables interaction |
| `size` | `"sm" \| "md" \| "lg"` | `"md"` | sm=32px, md=44px, lg=52px min-height |
| `block` | `boolean` | `false` | Full-width block button |
| `className` | `string` | — | Additional Tailwind classes |

### Variants

| Variant | Style | Use for |
|---|---|---|
| `default` | Panel-inset, muted text | Secondary actions, controls |
| `primary` | Neon primary gradient | Main CTA, confirm actions |
| `active` | Panel-inset + neon border | Toggle-on state |
| `record` | Crimson neon border, pulsing when `active` | Recording trigger |
| `danger` | Crimson text | Destructive / irreversible actions |

### Example

```tsx
// Primary action
<TactileButton
  label="GENERATE"
  variant="primary"
  icon={<Bot className="h-3.5 w-3.5" />}
  onClick={handleGenerate}
/>

// Toggle
<TactileButton
  label="LOOP"
  active={loopEnabled}
  onClick={() => setLoopEnabled(!loopEnabled)}
/>

// Record
<TactileButton
  label="REC"
  variant="record"
  active={recording}
  icon={<Circle className="h-3.5 w-3.5" />}
  onClick={toggleRec}
/>
```

---

## ModuleHeader

Every module page is automatically wrapped in `<ModuleHeader>` by the `<ModulePage>` component in `Index.tsx`. Module components do **not** render their own header.

The header provides:
- Module name badge (font-display, neon primary)
- BPM display (tap for tap-tempo)
- Record / Stop / Play transport controls
- Pattern name + step counter (hidden on xs viewports)
- Scene counter (hidden on xs viewports)
- Sync status LED + source label

```tsx
// In Index.tsx — automatic wrapping:
{tab === "SEQ" && <ModulePage tab="SEQ"><SeqTab /></ModulePage>}

// If a module needs to render its own header for any reason:
import { ModuleHeader } from "@/components/groovebox/ModuleHeader";
<ModuleHeader module="GROOVE" />
```

---

## Navigation — TabBar (ModuleNav)

The bottom navigation renders 12 modules in linear order. A secondary sub-tab strip appears above the module strip when the active module has sub-tabs.

**Module → default TabKey mapping:**

| Module | Default Tab | Sub-tabs |
|---|---|---|
| HOME | `HOME` | — |
| GROOVE | `SEQ` | SEQ, ROLL, PTN, SND |
| ARP | `ARP` | — |
| 3D SYNTH | `SYNTH3D` | — |
| 3D BASS | `BASS3D` | — |
| SAMPLE FORGE | `SMPL` | — |
| FX MIX LAB | `FX` | FX, MIX, PROD |
| VOICE | `VOICE` | — |
| REMIX | `REMIX` | REMIX, PERF |
| AI | `AI` | — |
| bRAINWAVEz | `BRN` | BRN, SPC |
| SETTINGS | `SETUP` | SETUP, SYNC, DIAG, LIB |

The nav preserves the last-active sub-tab per module across navigation (using a `useRef` map). Tapping a module hub always resumes where the user left off.

---

## Adding a New Module

1. Create `src/components/groovebox/MyModuleTab.tsx`
2. Add the `TabKey` to the union in `src/lib/store.ts`
3. Register in `src/pages/Index.tsx`:
   ```tsx
   {tab === "MYMOD" && <ModulePage tab="MYMOD"><MyModuleTab /></ModulePage>}
   ```
4. Add to `MODULES` array in `src/components/groovebox/TabBar.tsx`
5. Add to `MODULE_NAMES` map in `src/pages/Index.tsx`
6. Build and typecheck: `npm run build`
