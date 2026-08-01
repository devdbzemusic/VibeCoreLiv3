# MODULE UI — Accessibility

**Touch-First · Große Berührungsflächen · Kurze Wege · Schnelle Gesten**
**Status:** Production Ready

---

## Touch-Regeln

| Regel | Spezifikation |
|------|---------------|
| Mindest-Touch-Ziel | 44px × 44px für Kern-Interaktionen |
| Tap-Highlight | `transparent` (global) |
| Touch-Action | `manipulation` (global), `none` auf Slidern |
| Overscroll | `none` (verhindert versehentliches Scrollen) |

## Tablet und Smartphone

Tablet und Smartphone besitzen dieselbe Bedienlogik. Keine separaten Layouts — responsive Skalierung über Tailwind Breakpoints.

| Breakpoint | Verhalten |
|------------|-----------|
| < 640px (sm) | Mobile — vertikales Layout, horizontale Scrolls |
| 640-768px | Tablet — gleiche Logik, mehr sichtbare Elemente |
| > 768px (md) | Desktop — zusätzliche Info-Panels (CPU, Pattern) |

## Kontrast

- Vordergrund: HSL 195 100% 92% auf Hintergrund HSL 222 47% 4%
- Hoher Kontrast für Lesbarkeit bei verschiedenen Lichtverhältnissen
- Primary-Akzent (Cyan/Blau) immer klar vom Hintergrund abgehoben

## Bewegungsreduktion

```css
@media (max-width: 768px), (pointer: coarse) {
  /* Reduce backdrop-filter, shadows, gradients */
  /* Improve performance on mid-range devices */
}
```

## ARIA-Labels

Alle interaktiven Elemente haben ARIA-Labels:
- `aria-label` auf Buttons ohne Text
- `aria-pressed` auf Toggle-Buttons
- `aria-label` auf Range-Inputs

## Safe Areas

```css
padding-top: max(env(safe-area-inset-top), 0.5rem);
padding-bottom: max(env(safe-area-inset-bottom), 0.25rem);
```

## Tastatur-Navigation

- Tab-Navigation funktioniert (TabBar Hubs, TopBar Controls)
- Enter/Space aktiviert Buttons
- Range-Inputs mit Pfeiltasten bedienbar