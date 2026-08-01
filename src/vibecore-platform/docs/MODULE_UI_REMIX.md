# MODULE UI — Remix

**Live-Arrangement · Pattern-Reihenfolge · Songstruktur · Transitions**
**Status:** Production Ready

---

## Übersicht

Der Remix Tab ist die Live-Arrangement-Oberfläche. Keine klassische Timeline — stattdessen Pattern-Chain-basiertes Arrangement.

### Aufbau
1. Pattern Chain (horizontale Step-Strip mit Repeat/Skip/Marker/Reorder)
2. Quick-Add Pattern (Grid aller verfügbaren Patterns)
3. AI Remix Assistant (Song Structure, Remix Idea, Transition)
4. Live Pattern Switch (Performance-Grid)

## Pattern Chain

- Horizontale Step-Strip (horizontal scrollbar)
- Pro Step: Pattern-Name, Repeat-Count (×N), Skip-Toggle, Move-Left/Right, Delete
- Marker-Labels pro Step (INTRO, BUILD, DROP, etc.)
- Chain Mode: IMMEDIATE (sofort) oder BOUNDARY (an Taktgrenze)
- Clear-Button leert die gesamte Chain

### Store Actions
- `addToChain(patternId, repeat)`
- `removeFromChain(idx)`
- `setChainStepRepeat(idx, repeat)`
- `toggleChainStepSkip(idx)`
- `moveChainStep(fromIdx, toIdx)`
- `clearChain()`
- `setChainMode(mode)`

## Quick-Add Pattern

- Grid aller verfügbaren Patterns (4-Spalten)
- Ein Tap fügt Pattern zur Chain hinzu
- Zeigt aktuellen Pattern (neon-border)

## AI Remix Assistant

| Aktion | Funktion | Ergebnis |
|--------|----------|----------|
| SONG STRUCTURE | `suggestSongStructure` | Komplette Chain mit Markers |
| REMIX IDEA | `suggestRemixIdea` | Struktur + kreativer Ansatz |
| TRANSITION | `suggestRemixTransition` | Übergangs-Idee (Text) |

- Genre-Auswahl (Techno, House, DnB, Ambient, Pop)
- "APPLY CHAIN" übernimmt AI-Vorschlag als Chain
- Alle Vorschläge optional und rückgängig

## Live Pattern Switch

- Grid aller Patterns (4-Spalten)
- Ein Tap queued den Pattern für die nächste Taktgrenze
- Zeigt Current (gradient) und Queued (neon-border)
- Funktioniert während laufender Wiedergabe ohne Unterbrechung

## Performance-Regeln

- Keine Audio-Unterbrechung bei Pattern-Switch
- Queue-basiert (VibeCore Sync quantise-grid)
- Alle UI-Updates auf Control-Thread