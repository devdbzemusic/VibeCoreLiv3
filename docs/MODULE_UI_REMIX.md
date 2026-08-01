# REMIX Module UI Spec

## Overview
Live arrangement surface using a queue-based pattern chain. No classic timeline. Pattern tiles are the primary touch targets for live performance.

## 3-Touch Access
| Touch | Action |
|-------|--------|
| 1 | Tap a pattern tile in the PATTERNS grid (adds to chain) |
| 2 | Adjust repeat count (−/×N/+) on the chain step tile |
| 3 | Tap the transition arrow between steps to cycle CUT → FILL → FADE |

## Layout (top → bottom)
1. **Pattern Chain** — horizontal scrolling strip of chain step tiles; each tile shows name + ×N repeat; skip toggle + delete + reorder; transition arrows between steps
2. **Pattern Grid** — 4-column grid of all patterns; tap to add to chain; long-press (right-click) opens in Piano Roll
3. **Live Switch** — 4-column performance grid; tap to queue for next bar; queued pattern shows "QUEUED" badge
4. **AI Arrangement** — genre pill selector + SONG STRUCTURE / REMIX IDEA buttons + AiContextButton

## Transition Types (per gap between chain steps)
- **CUT** — instant switch (red indicator)
- **FILL** — auto-generated fill (amber indicator)
- **FADE** — crossfade (cyan indicator)
- Stored in local `transitions: TransitionType[]` state; index `i` applies between chain step `i` and `i+1`
- Tap arrow to cycle through types

## Chain Step Tile Controls
- Pattern name (font-display)
- Repeat: `−` / `×N` / `+` buttons
- Skip toggle: eye/eye-off icon
- Delete: trash icon

## AI Actions
- **Generate Arrangement** → `suggestSongStructure()` — creates `ChainStep[]`, user confirms "APPLY · N STEPS"
- **Remix Idea** → `suggestRemixIdea()` — returns description + optional chain steps

Both log to `aiHistory`.

## Files
- `src/components/groovebox/RemixTab.tsx`
- `src/lib/ai/remixAssistant.ts`
- `src/lib/ai/arrangementAssistant.ts`
