---
name: VibeCore Univers SUPREMÉ Constitution
description: Top-level project constitution — 7 bands in VibeCoreUnivers/SUPREME/. The One Rule (every decision must improve at least one of 8 goals). SUPREMÉ APPROVED gate (7 questions). Supersedes all other documents on conflict. Does NOT replace existing docs — builds on them.
---

# VibeCore Univers SUPREMÉ — Agent Reference

## Hierarchy
This is the TOP-LEVEL CONSTITUTION. It supersedes all other documents when there is a conflict.
It builds on (does not replace): MASTERPROMPT.md · NATIVE_AUDIO_PLATFORM.md · FX_MIXLAB_SUPREME.md · AI_ARP_INTELLIGENCE.md

## The One Rule (non-negotiable, unchangeable)
> Every architecture decision must demonstrably improve at least one of:
> Creativity · Workflow · Sound Quality · Realtime Capability · Stability · Extensibility · Maintainability · User Experience
> If no improvement can be proven → decision is NOT implemented.

## Document Structure
```
VibeCoreUnivers/
├── MASTERPROMPT.md          ← root entry point + quick-reference invariants
└── SUPREME/
    ├── INDEX.md
    ├── 01_Executive_Constitution.md  ← Vision · Mission · Board · Design Principles
    ├── 02_Platform_Constitution.md   ← Oboe · DSP Core · Audio Graph · Sync · Memory · Threading
    ├── 03_Creative_Universe.md       ← All modules: Groove · Synth · Bass · Voice · Forge · FX · Wave
    ├── 04_AI_Constitution.md         ← ARP · Genre Intelligence · Energy Engine · Learning Policy
    ├── 05_UX_Constitution.md         ← Hardware Feeling · One Touch · 5s Rule · Mobile First · Design System
    ├── 06_Quality_Constitution.md    ← DoR · DoD · 6 Gates · Reviews · Android · Security · Docs
    └── 07_Future_Constitution.md     ← Plugin SDK · Cloud · Desktop · VST/AU · Multi-user · Hardware
```

## WORKFLOW FIRST POLICY — oberstes Gate (added 2026-08-01)
> "Der Workflow ist das Produkt."
Phase 1 must be 100% complete before any audio/DSP/performance/test work.
No feature code without WORKFLOW APPROVED status.
Development order: Workflow → UI → UX → Live Performance → Architecture → Implementation → Integration → Tests → Performance → Release

### Workflow Gate (all 7 must be YES — else redesign UI, no code)
1. Reachable in ≤ 5 seconds?
2. Operable with one hand?
3. Usable in live performance without thinking?
4. Ergonomic on both phone and tablet?
5. Instantly findable during a performance?
6. Requires ≤ 1 touch or clear gesture?
7. Avoids unnecessary navigation?

### WORKFLOW FIRST — mandatory before any code change
1. Analyze workflow → 2. Identify duplicate functions → 3. Remove unnecessary nav →
4. Reduce clicks/gestures → 5. Check live workflow → 6. Design optimal UI → 7. Executive Board approval → THEN implement.

### Executive Board evaluates (workflow criteria only, before all else)
One Touch · Five Second Rule · Hardware Feeling · Live Performance · Consistency · Ergonomics · Learnability · Modularity · Visibility · Creative Flow

## SUPREMÉ APPROVED Gate — now 2 stages
Stage 1: Workflow Gate (7 questions above) → WORKFLOW APPROVED
Stage 2: SUPREMÉ Gate (original 7 questions)
1. Improves creative workflow?
2. Deterministic and realtime-capable?
3. Compatible with platform architecture?
4. Doesn't increase performance cost (or improves it)?
5. Long-term maintainable and modularly extensible?
6. Supports professional mobile live-performance groovebox vision?
7. Improvement provable against The One Rule?
→ Only when both stages pass: SUPREMÉ APPROVED – GO FOR IMPLEMENTATION.

## Critical Invariants (quick lookup)
- ONE Oboe engine · ONE VibeCore Sync · ZERO allocs in audio thread
- Audio callback: ONLY mix + DSP + output
- REMIX = sub-tab of FX MIX LAB (not standalone)
- ARP = sub-tab of GROOVE (not standalone)
- AI = suggestions only, never controls audio, no own clock
- Max nav depth: 2 levels
- One Touch · Five Second Rule · Hardware Feeling · One Control = One Function
