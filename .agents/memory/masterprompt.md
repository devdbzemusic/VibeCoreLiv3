---
name: VibeCoreLiv3 MASTERPROMPT v3.0
description: Supreme Architect governing rules — Implementation-First Policy, 8 mandatory gates, Definition of Done, Golden Rule. Build first, plan only when necessary.
---

# VibeCoreLiv3 MASTERPROMPT v3.0 — Agent Reference

## The Golden Rule
> Every technical decision serves one purpose only: to accelerate the musician's creative flow.
> The creative flow is the product.

## IMPLEMENTATION-FIRST POLICY (new in v3.0)
- Vision > historical decisions. Old rules/prompts/arch decisions are HISTORICAL REFERENCE only if they slow development, hurt workflow, limit audio quality, block vision, prevent modern solutions, restrict AI, hurt mobile perf, or reduce UX.
- **Architecture Evolution**: any architecture can be improved, replaced, or fully redesigned if the new solution is objectively better. No file has special status. No implementation is immutable.
- **Refactor First**: if existing code blocks implementation → refactor, simplify, modularize, merge, or replace. Do NOT code around it. Do NOT add technical debt.
- **No Legacy Bias**: never hold onto a past decision just because it exists. Evaluate every task as if the system is being built today.
- **Implementation over Documentation**: priority order: 1. Working implementation 2. Automated tests 3. Review 4. Documentation
- **Build, don't plan**: default behavior = implement → compile → test → fix → retest → optimize. Plan ONLY when strictly required for implementation.
- **Continuous Review**: after every completed feature, automatically run: Code / Audio / Workflow / Performance / AI / UX review. Fix findings immediately.

## Definition of Done (new in v3.0)
A task is complete ONLY when ALL of these are true:
1. Implemented (fully)
2. Build succeeds (no errors)
3. All relevant tests pass
4. No known open blockers
5. Feature is usable in the UI
6. Workflow improved or at minimum not degraded

One criterion open = task stays active. No exceptions.

## The 8 Mandatory Gates (apply BEFORE implementation)
Run all 8 before writing code. One NO = stop, rework, re-check.

- **Gate 1 — Workflow**: musikalisch sinnvoll? reduziert Arbeit? intuitiv? ohne Erklärung verständlich? erhöht Flow? (all YES)
- **Gate 2 — Performance**: latency in budget · UI smooth · no dropouts · minimal RAM · CPU in limits
- **Gate 3 — Audio Quality**: no signal degradation · sample-accurate sync · deterministic · no clipping · no phase errors · no level jumps
- **Gate 4 — AI**: supports creative process · saves time · learns from user · user in control always · suggestions explainable & editable (all YES)
- **Gate 5 — Simplicity**: complexity ONLY internal — never in UI. Visible complexity = design failure.
- **Gate 6 — Tomorrow Sound**: makes sound more modern · opens new creative options · differentiates from DAWs · supports vision (all YES)
- **Gate 7 — Learning AI**: AI learns continuously, adapts to individual style WITHOUT taking over. User control always.
- **Gate 8 — Instant Music**: first loop within 5 seconds of launch. No registration/config/setup/tutorial. Any feature slowing this = rework immediately.

## Combined Checklist
```
GATES (before):           DoD (after):
[ ] Gate 1 Workflow       [ ] Implemented
[ ] Gate 2 Performance    [ ] Build OK
[ ] Gate 3 Audio Quality  [ ] Tests pass
[ ] Gate 4 AI             [ ] No blockers
[ ] Gate 5 Simplicity     [ ] UI usable
[ ] Gate 6 Tomorrow Sound [ ] Workflow OK
[ ] Gate 7 Learning AI
[ ] Gate 8 Instant Music
```

## Other non-negotiable rules
- One Touch: max 1 touch for common actions, ceiling 2, no multi-step dialogs
- No disruption: zero blocking dialogs/popups/confirmations during production
- Module isolation: Sync/Groove/Remix/Voice/Forge/FX/Synth/Bass/AI/Brainwavez — interfaces only
- DSP priority: max quality → min latency → deterministic → low CPU → stable realtime

## Full document
`MASTERPROMPT.md` in project root (v3.0).
