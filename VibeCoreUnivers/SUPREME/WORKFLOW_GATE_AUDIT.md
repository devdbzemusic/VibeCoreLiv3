# WORKFLOW GATE AUDIT

**VibeCore Univers · SUPREMÉ MASTERPROMPT**  
**Audit Date:** 2026-08-02  
**Auditor:** Creative Master Workflow Senior SUPREMÉ Manager  
**Authority:** Executive Constitution Band I · UX Constitution Band V · WORKFLOW FIRST POLICY

---

## Purpose

Every proposed task must pass the 7-question Workflow Gate before any code is written.  
A single **NO** answer triggers a mandatory UI redesign step as a prerequisite.  
Only tasks with all **YES** answers receive **WORKFLOW APPROVED** status.

---

## Workflow Gate — 7 Questions

| # | Question |
|---|----------|
| Q1 | Is it reachable within a maximum of 5 seconds? |
| Q2 | Is it operable with one hand? |
| Q3 | Is it usable during live performance without thinking? |
| Q4 | Is it equally ergonomic on smartphone and tablet? |
| Q5 | Can it be found immediately during a performance? |
| Q6 | Does it require a maximum of one touch or a clear gesture? |
| Q7 | Does it avoid unnecessary navigation? |

---

## Audit Results

---

### Task #27 — Add WORKFLOW APPROVED status to the Quality Gate so no PR can merge without it

**Category:** Process / CI Enforcement  
**Module:** Quality Gate (CI / PR workflow)

| # | Question | Answer | Reasoning |
|---|----------|--------|-----------|
| Q1 | Reachable ≤ 5 s? | ✅ YES | Runs automatically in CI — zero manual steps needed |
| Q2 | One-hand operable? | ✅ YES | Automated gate; developer reads PR status passively |
| Q3 | Live usable without thinking? | ✅ YES | Automated enforcement — no cognitive load on developer |
| Q4 | Ergonomic on phone + tablet? | ✅ YES | GitHub PR status visible on any device |
| Q5 | Findable during performance? | ✅ YES | Status badge always visible on the PR |
| Q6 | ≤ 1 touch or clear gesture? | ✅ YES | No extra steps — gate runs automatically |
| Q7 | Avoids unnecessary navigation? | ✅ YES | Integrated into existing Quality Gate pipeline |

**Verdict: ✅ WORKFLOW APPROVED**  
**Rationale:** This task enforces the Constitution itself. It is a prerequisite for the integrity of all other tasks. Proceed immediately.  
**Priority: 1 — CRITICAL (enforces the gate for all future work)**

---

### Task #13 — Make the GROOVE drawers feel native on mobile — swipe-up to open

**Category:** UX / Gesture Implementation  
**Module:** GROOVE

| # | Question | Answer | Reasoning |
|---|----------|--------|-----------|
| Q1 | Reachable ≤ 5 s? | ✅ YES | Swipe-up from GROOVE screen — instantaneous, 0 s overhead |
| Q2 | One-hand operable? | ✅ YES | Thumb swipe-up is the canonical one-hand mobile gesture |
| Q3 | Live usable without thinking? | ✅ YES | Native platform gesture — muscle memory, no cognitive load |
| Q4 | Ergonomic on phone + tablet? | ✅ YES | Swipe-up is standard across all screen sizes |
| Q5 | Findable during performance? | ✅ YES | Implicit gesture — no button to search for |
| Q6 | ≤ 1 touch or clear gesture? | ✅ YES | One gesture (swipe-up) = drawer opens |
| Q7 | Avoids unnecessary navigation? | ✅ YES | Replaces a button-tap sequence; reduces navigation steps |

**Verdict: ✅ WORKFLOW APPROVED**  
**Rationale:** Directly implements UX Constitution Band V §Touch Gestures ("Swipe Up → Drawer open"). This is a constitutional alignment, not a new feature.  
**Priority: 2 — HIGH (live performance critical; gesture standard must ship)**

---

### Task #14 — Keep custom slice markers from resetting when you leave the Sample Forge

**Category:** Bug Fix / State Persistence  
**Module:** SAMPLE FORGE

| # | Question | Answer | Reasoning |
|---|----------|--------|-----------|
| Q1 | Reachable ≤ 5 s? | ✅ YES | SAMPLE FORGE is in bottom nav — 1 tap |
| Q2 | One-hand operable? | ✅ YES | No interaction change; markers persist automatically |
| Q3 | Live usable without thinking? | ✅ YES | Fix restores live-usable state; broken persistence actively breaks live workflow |
| Q4 | Ergonomic on phone + tablet? | ✅ YES | Purely backend state — no UI change required |
| Q5 | Findable during performance? | ✅ YES | Markers visible in SAMPLE FORGE view |
| Q6 | ≤ 1 touch or clear gesture? | ✅ YES | No extra user interaction required; persistence is automatic |
| Q7 | Avoids unnecessary navigation? | ✅ YES | Eliminates forced re-navigation back to SAMPLE FORGE to re-set markers |

**Verdict: ✅ WORKFLOW APPROVED**  
**Rationale:** Active regression that disrupts live workflow. State persistence is a foundational UX requirement. No new UI design needed — fix existing state management.  
**Priority: 3 — HIGH (live workflow blocker; fix before adding new features to SAMPLE FORGE)**

---

### Task #12 — Keep the Piano Roll smooth when patterns have many notes

**Category:** Performance Optimization  
**Module:** Piano Roll (GROOVE)

| # | Question | Answer | Reasoning |
|---|----------|--------|-----------|
| Q1 | Reachable ≤ 5 s? | ✅ YES | Already accessible; no navigation change |
| Q2 | One-hand operable? | ✅ YES | No interaction change; optimization is transparent |
| Q3 | Live usable without thinking? | ✅ YES | Smooth rendering = no performance disruption; jank breaks live focus |
| Q4 | Ergonomic on phone + tablet? | ✅ YES | 60 FPS target applies equally to all screen sizes |
| Q5 | Findable during performance? | ✅ YES | Piano Roll location unchanged |
| Q6 | ≤ 1 touch or clear gesture? | ✅ YES | No interaction change |
| Q7 | Avoids unnecessary navigation? | ✅ YES | Optimization is invisible to the user |

**Verdict: ✅ WORKFLOW APPROVED**  
**Rationale:** UX Constitution Band V §Mobile Performance mandates 60 FPS on mid-range devices with no jank at audio callbacks. Jank in the Piano Roll directly violates this. Pure technical optimization — no UI design step required.  
**Priority: 4 — HIGH (stability prerequisite before Piano Roll automation is added)**

---

### Task #4 — Sync BPM with Ableton Live and hardware gear over a network

**Category:** Live Performance / Integration  
**Module:** TopBar (BPM area) + SETTINGS

| # | Question | Answer | Reasoning |
|---|----------|--------|-----------|
| Q1 | Reachable ≤ 5 s? | ✅ YES | Sync toggle must live in the TopBar BPM area — always visible, 0 taps |
| Q2 | One-hand operable? | ✅ YES | Single toggle; status indicator is passive |
| Q3 | Live usable without thinking? | ✅ YES | Once connected, sync is automatic — zero cognitive load during performance |
| Q4 | Ergonomic on phone + tablet? | ✅ YES | TopBar BPM area adapts to all screen sizes |
| Q5 | Findable during performance? | ✅ YES | TopBar is always visible; sync status indicator is persistent |
| Q6 | ≤ 1 touch or clear gesture? | ✅ YES | One tap on sync icon to toggle; auto-connects |
| Q7 | Avoids unnecessary navigation? | ✅ YES | No navigation to SETTINGS required during performance; setup is one-time |

**Verdict: ✅ WORKFLOW APPROVED**  
**Rationale:** BPM sync is live-critical infrastructure. UI constraint: sync toggle and status indicator **must** be placed in the TopBar BPM area, not buried in SETTINGS. Connection setup (one-time) may live in SETTINGS.  
**UI Constraint:** Sync status LED + toggle in TopBar BPM zone. SETTINGS contains network address config only.  
**Priority: 5 — HIGH (live performance infrastructure)**

---

### Task #16 — Make the AI Optimize button on 3D Synth actually change how the sound feels

**Category:** AI Feature Implementation  
**Module:** 3D SYNTH → AI Optimize

| # | Question | Answer | Reasoning |
|---|----------|--------|-----------|
| Q1 | Reachable ≤ 5 s? | ✅ YES | 3D SYNTH in bottom nav → AI Optimize button visible on-screen |
| Q2 | One-hand operable? | ✅ YES | Single tap on AI Optimize button |
| Q3 | Live usable without thinking? | ✅ YES | One-tap sound optimization — exactly the Hardware Feeling principle |
| Q4 | Ergonomic on phone + tablet? | ✅ YES | Button target ≥ 44 pt; works at all sizes |
| Q5 | Findable during performance? | ✅ YES | AI Optimize button visible in 3D SYNTH without scrolling |
| Q6 | ≤ 1 touch or clear gesture? | ✅ YES | One tap — result applied immediately |
| Q7 | Avoids unnecessary navigation? | ✅ YES | Operates in-place; no screen change required |

**Verdict: ✅ WORKFLOW APPROVED**  
**AI Constitution Constraint:** Results must be **optional + editable + transparent** per Band IV. UI must display which parameters changed and offer one-tap undo. Parameters are shown as a diff overlay — not a dialog.  
**Priority: 6 — MEDIUM-HIGH (differentiating live feature)**

---

### Task #15 — Give the Forge sound designer the same instrument-first layout as the other modules

**Category:** Layout Consistency  
**Module:** SAMPLE FORGE

| # | Question | Answer | Reasoning |
|---|----------|--------|-----------|
| Q1 | Reachable ≤ 5 s? | ✅ YES | SAMPLE FORGE is in bottom nav |
| Q2 | One-hand operable? | ✅ YES | Consistent layout means existing muscle memory applies |
| Q3 | Live usable without thinking? | ✅ YES | Consistency across modules is a prerequisite for live use without thinking |
| Q4 | Ergonomic on phone + tablet? | ✅ YES | Other modules already pass this; Forge will inherit the same layout contract |
| Q5 | Findable during performance? | ✅ YES | Instrument controls will be in the expected primary position |
| Q6 | ≤ 1 touch or clear gesture? | ✅ YES | Layout change does not add interaction steps |
| Q7 | Avoids unnecessary navigation? | ✅ YES | Consistent layout reduces confusion-driven navigation |

**Verdict: ✅ WORKFLOW APPROVED**  
**Prerequisite:** UI design spec must document the exact "instrument-first" layout pattern used by other modules (3D SYNTH, 3D BASS) so SAMPLE FORGE can match it precisely. This spec must be approved before implementation begins.  
**Priority: 7 — MEDIUM (consistency; unblocks muscle memory for live users)**

---

### Task #2 — Assign parts to specific mixer buses for better mix control

**Category:** Mixer Routing  
**Module:** FX MIX LAB → MIX sub-tab

| # | Question | Answer | Reasoning |
|---|----------|--------|-----------|
| Q1 | Reachable ≤ 5 s? | ✅ YES | FX MIX LAB in bottom nav → MIX sub-tab |
| Q2 | One-hand operable? | ✅ YES | Tap-to-assign with good touch targets |
| Q3 | Live usable without thinking? | ⚠️ CONDITIONAL | Bus assignment is a setup task (pre-performance); must not block live flow |
| Q4 | Ergonomic on phone + tablet? | ❌ NO | Mixer matrix view with many parts × buses is too dense on a phone screen without dedicated phone layout design |
| Q5 | Findable during performance? | ✅ YES | FX MIX LAB → MIX tab is clearly labeled |
| Q6 | ≤ 1 touch or clear gesture? | ❌ NO | Current undefined flow likely requires: tap part → tap bus selector → tap bus = 3 touches minimum |
| Q7 | Avoids unnecessary navigation? | ✅ YES | Lives within FX MIX LAB where it belongs |

**Verdict: ❌ NEEDS REDESIGN**  
**Failing Questions:** Q4 (phone layout), Q6 (multi-touch assignment flow)  

**Required Redesign:**
1. **Phone layout:** Design a vertically scrollable part-list where each row shows the part name and a compact bus selector chip. Bus options rendered as a horizontal swipe row — one thumb gesture selects the bus.
2. **One-touch assignment:** Long-hold on a part opens an inline bus picker (no separate screen). Drag-to-bus or single-tap bus chip confirms assignment.
3. **Tablet layout:** Full matrix grid is acceptable at ≥768 pt.
4. UI spec must be approved before implementation.

**Priority: 8 — MEDIUM (after redesign spec is approved)**

---

### Task #11 — Draw filter and pan automation alongside notes in the Piano Roll

**Category:** Composition / Automation  
**Module:** Piano Roll (GROOVE)

| # | Question | Answer | Reasoning |
|---|----------|--------|-----------|
| Q1 | Reachable ≤ 5 s? | ✅ YES | Piano Roll already accessible; automation lanes added within it |
| Q2 | One-hand operable? | ⚠️ CONDITIONAL | Drawing on phone requires precision; single-finger drag may conflict with scroll |
| Q3 | Live usable without thinking? | ⚠️ CONDITIONAL | Automation drawing is a composition task, not live performance; must not degrade live Piano Roll use |
| Q4 | Ergonomic on phone + tablet? | ❌ NO | Piano Roll on phone is already space-constrained with notes; automation lanes add visual layers that are unreadable at 360 pt without a specific phone-first layout design |
| Q5 | Findable during performance? | ✅ YES | Automation lanes within the Piano Roll are contextually logical |
| Q6 | ≤ 1 touch or clear gesture? | ✅ YES | Draw gesture (drag) is one clear gesture per UX Constitution |
| Q7 | Avoids unnecessary navigation? | ✅ YES | Automation alongside notes — no screen switching needed |

**Verdict: ❌ NEEDS REDESIGN**  
**Failing Questions:** Q4 (phone layout for automation lanes)  

**Required Redesign:**
1. **Phone layout:** On screens < 480 pt, automation lanes must be toggled via a dedicated mode button (note mode ↔ automation mode) — not shown simultaneously. Full-lane view on tablet ≥ 768 pt.
2. **Lane selector:** Compact horizontal pill bar (Filter · Pan · Velocity · Pitch) above the roll — one tap switches the active automation lane. No dropdown.
3. **Drawing vs scrolling disambiguation:** Vertical drag = draw automation; horizontal drag = scroll time axis. Pinch = zoom. These must be tested for conflict resolution on a phone.
4. Prerequisite: Task #12 (Piano Roll performance) must be completed first — adding automation lanes to a janky Piano Roll compounds the problem.

**Priority: 9 — MEDIUM (after redesign spec is approved and Task #12 is complete)**

---

### Task #3 — Pick which MIDI knob/fader controls each modulation route

**Category:** MIDI Mapping / Modulation Routing  
**Module:** Undefined (no established location)

| # | Question | Answer | Reasoning |
|---|----------|--------|-----------|
| Q1 | Reachable ≤ 5 s? | ❌ NO | No established location in the navigation. If placed in SETTINGS it takes multiple taps and scrolling. Per-module MIDI mapping has no designated entry point. |
| Q2 | One-hand operable? | ❌ NO | MIDI mapping typically requires two hands — one on hardware, one on screen — but the screen-side interaction must be one-hand operable; currently undefined |
| Q3 | Live usable without thinking? | ❌ NO | MIDI mapping is setup-only; the question is whether *accessing* it during live performance (to re-map) is possible without interrupting the set |
| Q4 | Ergonomic on phone + tablet? | ❌ NO | MIDI route matrix (parameter × MIDI CC) is a dense UI that has no approved phone layout |
| Q5 | Findable during performance? | ❌ NO | No designated location; would require navigation through SETTINGS or module-specific sub-menus |
| Q6 | ≤ 1 touch or clear gesture? | ❌ NO | MIDI learn flow typically requires: enter learn mode → touch UI element → move hardware control → confirm = minimum 3 steps |
| Q7 | Avoids unnecessary navigation? | ❌ NO | No location defined; any proposed location risks adding navigation layers |

**Verdict: ❌ NEEDS REDESIGN**  
**Failing Questions:** Q1, Q2 (setup interaction model), Q4 (phone layout), Q5 (no home), Q6 (multi-step learn flow), Q7 (navigation undefined)  

**Required Redesign:**
1. **Location decision:** MIDI mapping must have a defined home. Options: (a) per-module long-hold on any knob/fader enters MIDI learn mode — no navigation required; (b) dedicated MIDI MAP sub-tab within each module. Option (a) is preferred — it satisfies Q1, Q5, Q6, Q7.
2. **MIDI Learn flow (phone-first):** Long-hold control → glow animation confirms learn mode → move hardware knob → auto-detected + confirmed in ≤ 1 s → tap anywhere else to exit. Maximum: hold + 1 tap = 1.5 interactions.
3. **Phone layout:** No matrix view. Each mapping displayed as a card: [control name] ↔ [MIDI CC + channel]. Accessible from a "MIDI" chip in each module's header.
4. Full redesign spec must be approved by Executive Board before implementation. This task has the most unknowns and requires the deepest UX design effort.

**Priority: 10 — LOWER (most complex; redesign spec required first; many dependencies on module architecture)**

---

## Summary Table — Priority-Ordered

| Priority | Task # | Title | Status | Action |
|----------|--------|-------|--------|--------|
| 1 | #27 | Add WORKFLOW APPROVED to Quality Gate | ✅ WORKFLOW APPROVED | Implement immediately |
| 2 | #13 | GROOVE drawers — swipe-up on mobile | ✅ WORKFLOW APPROVED | Implement immediately |
| 3 | #14 | Keep slice markers from resetting | ✅ WORKFLOW APPROVED | Implement immediately |
| 4 | #12 | Keep Piano Roll smooth (many notes) | ✅ WORKFLOW APPROVED | Implement immediately |
| 5 | #4  | Sync BPM with Ableton + hardware | ✅ WORKFLOW APPROVED | Implement with TopBar UI constraint |
| 6 | #16 | AI Optimize on 3D Synth (functional) | ✅ WORKFLOW APPROVED | Implement with AI diff-overlay constraint |
| 7 | #15 | Forge instrument-first layout | ✅ WORKFLOW APPROVED | Implement after layout spec is documented |
| 8 | #2  | Assign parts to mixer buses | ❌ NEEDS REDESIGN | Phone layout + one-touch flow spec required first |
| 9 | #11 | Piano Roll automation lanes | ❌ NEEDS REDESIGN | Phone layout spec required; Task #12 prerequisite |
| 10 | #3  | MIDI knob → modulation route mapping | ❌ NEEDS REDESIGN | Full UX architecture needed; deepest redesign required |

---

## Counts

| Status | Count |
|--------|-------|
| ✅ WORKFLOW APPROVED | 7 |
| ❌ NEEDS REDESIGN | 3 |
| **Total audited** | **10** |

---

## Mandatory Redesign Prerequisites

Before Tasks #2, #11, and #3 can receive a code ticket:

### Redesign Spec #A — Mixer Bus Assignment (for Task #2)
- Phone layout: vertical part-list with inline swipe-bus-picker
- One-touch assignment: long-hold → inline picker → single tap to assign
- Tablet layout: matrix grid
- Must be reviewed and approved by Executive Board

### Redesign Spec #B — Piano Roll Automation Lanes (for Task #11)
- Phone layout: mode toggle (note mode ↔ automation mode), no simultaneous lanes
- Automation lane selector: horizontal pill bar
- Gesture disambiguation rules (draw vs scroll vs zoom)
- Dependency: Task #12 must be complete before this ticket opens
- Must be reviewed and approved by Executive Board

### Redesign Spec #C — MIDI Modulation Mapping (for Task #3)
- Location: long-hold on any knob/fader = MIDI learn mode (preferred)
- Learn flow: hold → glow → move hardware → auto-confirm → tap to exit
- Phone view: card-based mapping list, no matrix
- Entry point: "MIDI" chip in each module header
- Must be reviewed and approved by Executive Board (highest complexity)

---

## Audit Authority

This audit is conducted under:
- **SUPREMÉ DIRECTIVE 001** — Workflow is Law
- **Band I Executive Constitution** §Executive Decision Gate — Stufe 1 WORKFLOW GATE
- **Band V UX Constitution** §WORKFLOW FIRST POLICY

All tasks marked **NEEDS REDESIGN** are blocked from implementation until their redesign spec receives **WORKFLOW APPROVED** status from the Executive Board.

All tasks marked **WORKFLOW APPROVED** are cleared to proceed to Stufe 2 (SUPREMÉ GATE) and then to implementation.

---

*WORKFLOW GATE AUDIT · VibeCore Univers SUPREMÉ MASTERPROMPT*  
*Produced: 2026-08-02 · This document supersedes any prior task prioritization that was established without a Workflow Gate audit.*
