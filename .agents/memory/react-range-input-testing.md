---
name: React range input testing
description: Browser automation detail for validating controlled range inputs in the VibeCore UI.
---

# Rule

Use real keyboard or dispatched input events when testing controlled range inputs. A programmatic DOM value change can make the slider look updated while leaving React/Zustand state unchanged until the next rerender.

**Why:** A mute action or other rerender can reveal the stale application value, making a valid UI interaction look like a persistence or state-reset bug.

**How to apply:** For MIX and similar controls, focus the range input and use Home/Arrow keys (or a framework-aware user-event helper), then verify the value again after the follow-up action.