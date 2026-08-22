---
name: MIDI CC input lifecycle
description: Directly assigned MIDI CC routes must initialize Web MIDI without requiring Learn first.
---

MIDI CC route assignment and MIDI Learn share one Web MIDI input lifecycle; entering a known CC number must be live immediately, while unavailable/no-input states must be visible in the editor.

**Why:** A route can be configured manually by users who already know their controller mapping. Starting Web MIDI only from the Learn button makes those routes silently neutral.

**How to apply:** Keep input initialization independent of the PTN view, preserve the existing modulation polling path as the sole consumer, and surface capability/connection errors before offering Learn.