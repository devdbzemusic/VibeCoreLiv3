# Module UI Accessibility Spec

## Touch Target Sizes
All interactive elements must meet minimum touch target requirements:

| Element type | Minimum size |
|-------------|-------------|
| TactileKnob (sm) | 44×44px (enforced by size prop) |
| TactileKnob (md) | 56×56px |
| TactileKnob (lg) | 72×72px |
| Step cell | 44px height (h-9 or h-10) |
| Button (action) | 44px height (h-11 or h-12) |
| IconButton | 28×28px minimum (h-7 w-7) |
| Tab pill | 28px height (h-7) |

## ARIA Labels
All interactive elements must have `aria-label` or visible text:

```tsx
// Step grid
<button aria-label={`Step ${i + 1} ${on ? "on" : "off"}`} />

// Record button
<button aria-label={recording ? "Stop recording" : "Start recording"} />

// Toggle buttons
<button aria-pressed={arp.enabled} aria-label={arp.enabled ? "Disable arp" : "Enable arp"} />
```

## Keyboard Navigation
- All buttons are focusable (`<button>` elements, not `<div onClick>`)
- Tab order follows visual reading order (top → bottom, left → right)
- TactileKnob supports keyboard via `aria-role="slider"` (implementation in TactileKnob.tsx)

## Color Usage
- Color is never the only differentiator — active state also uses `neon-border` border effect
- Disabled state uses `opacity-40 pointer-events-none` (not just color change)
- Recording state uses both red fill AND a pulse animation AND a Square/Stop icon change

## Motion & Animation
- All background animations in bRAINWAVEz use CSS `animationName: "pulse"` (Tailwind keyframe)
- No animation triggers layout reflow — only `opacity` changes in the keyframe
- Users with `prefers-reduced-motion` should see reduced animations (TODO: apply `@media (prefers-reduced-motion)` to BrainwaveBackground)
- Beat-sync dots in ARP use a brief 100ms CSS class application — not jarring

## Screen Reader Notes
- Module names are readable from the TabBar (font-display labels visible)
- Beat indicator dots have no SR content (purely visual feedback)
- AI activity log entries are in a readable list structure
- Step status (on/off) is encoded in `aria-label` and `data-active` attribute

## Focus Management
- After toggling record, focus stays on the record button (no focus jump)
- After adding a pattern to chain, focus stays on the pattern tile
- Deep editor accordion: when expanded, content is appended below — no scroll jump

## High-Contrast Considerations
- Neon colors (`text-neon-cyan`, `text-neon-magenta`) have sufficient contrast on dark background
- `text-muted-foreground` on `panel-inset` background: contrast ratio ≥ 3:1 (meets AA for large text)
- Active state: `text-primary` on dark backgrounds: ≥ 4.5:1 (meets AA)

## TODO (Future Work)
- [ ] Add `prefers-reduced-motion` media query to bRAINWAVEz background animations
- [ ] Test TactileKnob with screen reader (VoiceOver/TalkBack)
- [ ] Add `role="log"` + `aria-live="polite"` to AI Activity Log for automatic SR announcements
- [ ] Add keyboard shortcuts for transport control (Space = play/stop)
