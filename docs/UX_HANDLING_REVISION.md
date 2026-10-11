# VibeCoreLiv3 — Handling & Usability Revision

Status: DRAFT FOR IMPLEMENTATION
Date: 2026-09-16

## Product rule

VibeCore should be playable before it feels configurable.

Primary flow:

```text
HOME → GROOVE → SOUND → MIX → PERFORM
```

Advanced editing stays available through contextual/deep views.

## Progressive disclosure

### Live/performance layer
Show only the controls required to make an immediate musical change:
- transport
- scene/pattern
- 4–8 primary macros
- pads/keyboard
- quick mix
- immediate record/undo

### Studio/deep layer
Expose:
- detailed synthesis
- routing
- automation editing
- advanced FX
- diagnostics
- migration/developer information

## Touch targets

Live controls should target at least approximately 44×44 CSS pixels where layout permits.

Avoid tiny toggles in performance-critical areas.

## Gesture contract

- tap — select/action
- long press — context/detail
- vertical drag — knob/fader value where applicable
- horizontal drag — timeline/range/navigation where semantically appropriate
- vertical swipe — page scrolling
- horizontal swipe — only dedicated horizontal strips/grids
- double tap — reset/default for supported parameter controls
- pinch — zoom only in views that explicitly support it

A horizontal strip must not permanently trap vertical page scrolling when no active manipulation is underway.

## Parameter controls

Knobs/faders should support:
- movement threshold before edit begins
- readable current value
- fine adjustment mode
- reset/default gesture
- begin/end gesture lifecycle for automation/undo
- optional haptic feedback on Android

## Keyboard safety

Performance keyboards require:
- note-on on pointer/touch down
- guaranteed note-off on up
- note-off on cancel
- note-off on pointer loss/navigation/lifecycle pause
- all-notes-off recovery
- multi-touch
- optional slide-across-keys
- octave
- transpose
- velocity/gate
- optional scale/chord capabilities

## Navigation

Primary navigation should remain stable and predictable.

Deep technical modules should not continuously compete with core musical actions for screen space.

## Error/recovery UX

Errors should answer:
1. What happened?
2. Is audio/project data safe?
3. Can the user continue?
4. What fallback/recovery did VibeCore apply?

Avoid raw technical errors in normal performance UI.

## Startup

Target sequence:

```text
shell visible
→ project metadata/state
→ interactive UI
→ audio runtime lazy-ready
→ assets/analysis on demand
```

Do not decode/analyze every asset before the user can interact.

## Autosave

- mark dirty synchronously
- debounce persistent writes
- atomic snapshot/journal strategy
- never persist meter/drag/transient analyzer state

## Performance UX

Meters, playheads and visualizers may sample runtime state at UI rates. They must not force global application renders at audio/tick frequency.
