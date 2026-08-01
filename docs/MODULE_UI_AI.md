# AI Module UI Spec

## Overview
AI is context-based and surfaced per-module via `AiContextButton`. The AI module page is not a standalone chat interface — it is the **AI Activity Log** and **Global Style Configurator**.

## 3-Touch Access
| Touch | Action |
|-------|--------|
| 1 | Tap an AI Style preset (immediately biases all future AI actions) |
| 2 | Scroll the activity log |
| 3 | Open the CO-ASSISTANT drawer for groove/melody generation |

## Layout (top → bottom)
1. **AI Style selector** — 4×2 grid of 8 style presets; active preset highlighted with `neon-border`
2. **AI Activity Log** — last 10 AI actions across all modules, newest first; most recent entry has `neon-border`
3. **CO-ASSISTANT** — collapsible drawer containing `AiCoAssistant` for groove + melody generation

## AI Style Presets (8)
| Key | Description |
|-----|-------------|
| CLASSIC | Balanced, musical |
| MINIMAL | Sparse, focused |
| COMPLEX | Dense, layered |
| ORGANIC | Natural, breathing |
| DIGITAL | Quantized, precise |
| CINEMATIC | Wide, atmospheric |
| HYPNOTIC | Repetitive, trance |
| GLITCH | Broken, textured |

Stored as `aiStyle: AiStyle` in the Zustand store. Persisted in `partialize`.

## Activity Log Entry Format
```typescript
interface AiHistoryEntry {
  id: string;           // nextId("ai") — unique ID
  timestamp: number;    // Date.now() at time of action
  action: string;       // "Generated groove", "Optimized synth", etc.
  module: string;       // "GROOVE", "3D SYNTH", "3D BASS", "VOICE", "ARP", etc.
  description?: string; // optional detail
}
```

- Max 10 entries (FIFO, newest first)
- Timestamps displayed as relative ("2s ago", "5m ago")
- Module labels color-coded (`text-neon-lime` for GROOVE, `text-neon-cyan` for 3D SYNTH, etc.)

## Adding History Entries (from any module)
```typescript
const { addAiHistoryEntry } = useGroove();
addAiHistoryEntry({ action: "Generated groove", module: "GROOVE" });
```

## Store Fields
```typescript
aiHistory: AiHistoryEntry[];  // transient, not persisted
aiStyle: AiStyle;             // persisted via partialize
```

## Files
- `src/components/groovebox/AiSceneTab.tsx`
- `src/components/groovebox/AiCoAssistant.tsx`
- `src/lib/store.ts` — `AiStyle`, `AiHistoryEntry` types; `addAiHistoryEntry`, `setAiStyle` actions
