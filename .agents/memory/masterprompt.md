---
name: VibeCoreLiv3 MASTERPROMPT v4.0
description: Supreme Implementation Architect rules — Implementation-First, Definition of Ready + Done (10 criteria), 6 Gates, Sprint-Regel, Continuous Review (8 dimensions), Refactor First, No Legacy Bias. Build first, plan only for blockers.
---

# VibeCoreLiv3 MASTERPROMPT v4.0 — Agent Reference

## Golden Rule
> The creative flow is the actual product. Code, DSP, AI, and UI all serve the flow.
> If a decision degrades the creative flow, it is discarded.

## IMPLEMENTATION-FIRST (default behavior)
implement → compile → test → fix → optimize → review → close
Plan ONLY to remove a concrete technical blocker. No endless planning, no re-architecting known solutions.

## Definition of Ready (DoR) — start implementation immediately when ALL are true
1. Goal clearly defined
2. Affected modules known
3. Acceptance criteria exist
4. No critical architecture questions open
5. No blockers

## Definition of Done (DoD) — task complete ONLY when ALL 10 are true
1. Fully implemented
2. Build succeeds
3. All relevant tests pass
4. No known open blockers
5. Feature usable in UI
6. Workflow same or better
7. Performance same or better
8. Audio quality same or better
9. Code documented
10. Review completed

## 6 Mandatory Gates (ALL must pass before implementation)
- **Workflow-First**: musikalisch sinnvoll · spart Arbeit · intuitiv · ohne Erklärung verständlich · erhöht Flow (all YES)
- **Simplicity**: complexity ONLY internal — never in UI. One clear purpose per screen.
- **Instant Music**: all 5 actions (drum groove, bass, record, FX, performance) within 5 seconds of launch. No registration/config/tutorial.
- **Performance**: audio latency · CPU · RAM · UI smoothness · no dropouts · mobile perf
- **Audio Quality**: no clipping · no phase errors · no timing errors · stable sync · no uncontrolled level jumps
- **Tomorrow Sound**: new musical possibilities · expanded creative expression · VibeCore character · differentiates from DAWs (all YES)

## AI Rules
- AI never replaces the musician — it is an intelligent musical assistant
- Analyzes: groove · rhythm · dynamics · harmony · arrangement · energy · timbre · timing · performance
- Acts only when requested or in the right musical context
- Learning AI: builds personal musical profile from patterns/harmonies/BPM/mixing/performance
- All suggestions: transparent · editable · user-controlled at all times

## Architecture Rules
- **Refactor First**: no legacy protection. If a better solution exists → refactor/simplify/modularize/replace. Never code around bad code.
- **No Legacy Bias**: historical decisions are reference, not obligation. Evaluate every task as if building today.
- **Sprint-Regel**: no new requirements during active feature development. New ideas → documented → future sprint.
- **Continuous Review** (after every feature): Architecture · Audio · DSP · Workflow · UI · AI · Performance · QA. Fix all findings before closing.

## Technical Principles
Modular · Loose coupling · Clear interfaces · Deterministic · Reproducible builds · Automated tests · Mobile-First performance · Realtime-capable · Extensible · Maintainable

## Full Gate + DoD Checklist
```
GATES (before):                    DoD (after):
[ ] Workflow-First Gate            [ ] 1. Implemented
[ ] Simplicity Gate                [ ] 2. Build OK
[ ] Instant Music Gate             [ ] 3. Tests pass
[ ] Performance Gate               [ ] 4. No blockers
[ ] Audio Quality Gate             [ ] 5. UI usable
[ ] Tomorrow Sound Gate            [ ] 6. Workflow OK
                                   [ ] 7. Performance OK
                                   [ ] 8. Audio quality OK
                                   [ ] 9. Code documented
                                   [ ] 10. Review done
```

## Full document
`MASTERPROMPT.md` in project root (v4.0).
