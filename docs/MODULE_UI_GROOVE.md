# GROOVE Module — UI Specification

## Role
The GROOVE module is the central production surface of VibeCoreLiv3. It is the single editing surface for all content: drums, synth, bass, samples, and automation. There must be no second editing logic anywhere in the application.

## Navigation Entry Point
- TabBar shortLabel: **GRV**
- Primary tab: **ROLL** (Piano Roll) — opens immediately on GROOVE tap
- Secondary tab: **SEQ** (Step Sequencer, expert/alternative view)
- Additional sub-tabs: **PTN** (Pattern/Mod Matrix), **SND** (Sound/Channel)

## 3-Touch Access Map
All production actions are reachable within 3 touches from any state:

| Action | Touch count | Path |
|--------|-------------|------|
| Add/edit a note | 0–1 | Tap empty cell in Piano Roll grid |
| Switch part | 1 | PartStrip pill |
| Change pattern | 1 | `◀ PTN ▶` in compact header |
| Quantize | 1 | Grid selector → Magnet button |
| Paint sweep | 1 | Paint toggle → drag |
| Automation | 1 | Footer `AUTO` button |
| Pattern/Scene chain | 1 | Footer `CHAIN` button |
| OCT / Scroll / Undo | 1–2 | `···` More toggle |
| Step Sequencer | 1 | GRV → SEQ sub-tab |

## 8-Parameter Rule
At any time in the GROOVE Piano Roll, the maximum visible interactive parameters are **8**:

| # | Parameter | Location | Notes |
|---|-----------|----------|-------|
| 1 | Pattern | Compact header | Name + prev/next navigation |
| 2 | Quantize | Compact header | Grid size selector (1st / ½ / ¼ / ⅛) |
| 3 | Paint | Compact header | Sweep mode toggle |
| 4 | Erase | Compact header | Clear all notes in scene |
| 5 | Snap/Quant | Compact header | Apply quantize to grid |
| 6 | Note | Compact inspector | Pitch display for selected note |
| 7 | Velocity | Compact inspector | Draggable slider for selected note |
| 8 | Gate | Compact inspector | Length slider for selected note |

Secondary controls (OCT up/down, Scroll up/down, Undo, Redo, Copy, Paste, note count) are accessible via the **`···` More toggle** — a single tap reveals them in an expandable row above the grid. They do not count toward the 8-parameter limit.

Transport controls (Play/Pause, Record, Stop/Reset, BPM tap) live in the **ModuleHeader** rendered above the module by Index.tsx — also not counted against the 8.

## Component Architecture

```
Index.tsx
└── ModulePage tab="ROLL"
    ├── ModuleHeader module="GROOVE"  ← Play/Pause/Record/BPM tap
    └── GrooveModule
        ├── PianoRollTab compact={true}
        │   ├── PartStrip                     ← part selector pills
        │   ├── Compact Header Strip          ← 5 controls + More toggle
        │   │   └── More Panel (···)          ← OCT/scroll/undo/redo/copy/paste
        │   ├── RollDrumLane                  ← drum step triggers (aligned to grid)
        │   ├── Note Grid                     ← 16-semitone scrollable MIDI grid
        │   │   └── RollPlayhead              ← isolated ~20Hz re-render
        │   └── Compact Inspector             ← Note | Velocity | Gate
        ├── Footer Bar                        ← [AUTO] [CHAIN] [recording status]
        ├── AutomationDrawer (conditional)    ← VEL/PROB/GATE bar charts
        └── PatternChainDrawer (conditional)  ← PatternBrowser + SceneManager
```

## Piano Roll Layout
The note grid uses a fixed row height (`ROW_PX = 18`) for 16 visible semitones at a time. The view window is controlled by the OCT and scroll buttons in the More panel. A keyboard gutter on the left (38px) shows pitch labels and allows adding a note at pitch 0 on click.

The **RollDrumLane** strip sits directly above the note grid, aligned 1:1 with step columns. Toggling a drum step does not interrupt melodic note editing — same scroll width, same column width.

The **RollPlayhead** subscribes only to the `playheads` store slice (~20Hz writes) so it re-renders in isolation without touching the rest of the grid or the note inspector.

## Recording / Overdub Flow
1. User taps **Record** button in ModuleHeader → `toggleRec()` → `recording=true` in store
2. User taps **Play** in ModuleHeader → transport starts
3. While `recording && playing`:
   - Piano Roll grid shows a **pulsing red ring** (CSS `animate-pulse` + `border-neon-crimson`)
   - Footer bar shows "OVERDUB" indicator with pulse animation
   - Notes tapped/painted in the grid are added immediately via `addNote()`
   - Scheduler picks them up on the next loop tick — no audio thread contact from UI
4. User taps **Stop** → `recording` retained; tap Record again to disarm

## Automation Drawer
Opened via `[AUTO]` in the footer bar. Closes the Pattern Chain drawer (drawers are mutually exclusive).

Shows a **draggable bar chart** for the current part's step data:
- **VEL** lane: `step.velocity` (0–100)
- **PROB** lane: `step.probability` (0–100)
- **GATE** lane: `step.gate` (0–200, displayed at ½ scale)

Drag bars up/down to edit values in real time (via `updateStep`). Only triggered steps (`step.on === true`) render at full primary color; off steps are dimmed.

## Pattern Chain Drawer
Opened via `[CHAIN]` in the footer bar. Closes the Automation drawer.

A bottom sheet with swipe-down-to-close gesture (60px threshold on the drag handle). Contains:
1. `PatternBrowser` — grid of all patterns, search, favorites, copy/paste/duplicate/randomize/rename
2. `SceneManager` — scene strip with length selectors, copy/paste/move/trigger controls

## Out of Scope (Deferred)
- Real-time MIDI note input during recording (requires MIDI input hardware integration task)
- Pattern Chain Song-Mode rendering (covered in REMIX module task)
- Per-note automation (requires model changes to add per-note controller data)
