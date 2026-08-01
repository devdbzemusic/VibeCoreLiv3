# MODULE UI — Design System

**Einheitliche Buttons · Regler · Slider · Animationen · Typografie · Abstände**
**Status:** Production Ready

---

## Farbsystem

### Grundfarbe
Dunkel (HSL 222 47% 4%)

### Akzentfarben
| Farbe | HSL Token | Verwendung |
|-------|----------|------------|
| Cyan | `--cyan` (188 100% 55%) | Arrange/Mix Akzent |
| Blau | `--primary` (195 100% 55%) | Primär-Akzent |
| Türkis | `--primary-glow` (190 100% 65%) | Glow-Effekt |
| Magenta | `--magenta` (320 100% 60%) | Sound/Perform Akzent |
| Amber | `--amber` (38 100% 58%) | System/Warnung |
| Lime | `--lime` (140 100% 55%) | Aktiv/Playback |
| Crimson | `--crimson` (350 100% 60%) | Aufnahme/Fehler/Clipping |

### Farbregeln
- **Rot**: Nur Aufnahme, Fehler, Clipping
- **Grün**: Nur aktiv, Playback
- **Gelb**: Nur Warnungen

## Typografie

| Rolle | Font | Token |
|-------|------|-------|
| Display | Orbitron | `--font-display` |
| Body | Inter | `--font-body` |
| Mono | JetBrains Mono | `--font-mono` |

## Komponenten-Klassen

### Panel
```css
.panel — gradient-panel, border, glow-soft, inset-glow
.panel-inset — surface-0, border, inset shadow
```

### Hardware-Look
```css
.hw-bezel — brushed gradient, corner brackets, screws
.hw-screen — LCD-style screen surface
.hw-led — tiny LED indicator (6px)
.hw-divider — brushed-metal divider
```

### Step Cells
```css
.step-cell — base style
.step-cell[data-active="true"] — gradient-primary, glow
.step-cell[data-playing="true"] — accent outline
.step-cell[data-accent="true"] — gradient-accent, glow
```

### Pads
```css
.pad — base, active:scale
.pad[data-on="true"] — neon glow
```

### Tab Pills
```css
.tab-pill — rounded, transition
.tab-pill[data-active="true"] — gradient, inset glow
```

## Animationen

| Keyframe | Verwendung |
|----------|------------|
| `pulse-neon` | Recording indicator |
| `blink` | Status indicators |
| `slide-in` | Page transitions |
| `meter` | Meter bars |

## Mobile Overrides

```css
@media (max-width: 768px), (pointer: coarse) {
  /* Disable backdrop-filter, reduce shadows, simplify gradients */
}
```

## Touch-Regeln

- Mindestens 44px Touch-Ziel für Kern-Interaktionen
- `touch-action: manipulation` global
- `-webkit-tap-highlight-color: transparent`
- `touch-none` auf Slidern und Step-Cells