# 01 — Blueprint (Phasen-Modell & Abhängigkeitsmatrix)

> Phase/Doc 01 · Status: Draft v1.0 · Owner: Senior Software System Architect · Review: 15-Rollen, 2/3-Mehrheit

## 1. Systemgrenzen
```
┌──────────────────────────────────────────────────────────────┐
│  SDK (C-ABI, Wrapper, Validator)          Phase 5            │
├──────────────────────────────────────────────────────────────┤
│  Host Runtime (Loader, I/O, Safe-Mode)    Phase 4           │
├──────────────────────────────────────────────────────────────┤
│  Project Runtime (Project/Scene/Pattern)  Phase 3           │
├──────────────────────────────────────────────────────────────┤
│  Sync Engine (einzige Zeitbasis)           Phase 2           │
├──────────────────────────────────────────────────────────────┤
│  Platform Core (DSP-Graph, Routing, Serial.) Phase 1          │
└──────────────────────────────────────────────────────────────┘
   Musikalischer Core: Groove(6) → FX(7) → Synth(8) → Sample(9) → Remix(10)
```

## 2. Abhängigkeitsmatrix
|       | 1 Core | 2 Sync | 3 Proj | 4 Host | 5 SDK | 6 Groove | 7 FX | 8 Synth | 9 Sample | 10 Remix |
|-------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **1 Core** | — | ● | ● | ● | ● | ○ | ○ | ○ | ○ | ○ |
| **2 Sync** | | — | ● | ● | | ● | | ● | ● | ● |
| **3 Proj** | | | — | ● | | ● | | | | ● |
| **4 Host** | | | | — | ● | ● | ● | ● | ● | ● |
| **5 SDK** | | | | | — | | | | | |
- ● starke Abhängigkeit (baut auf) · ○ verwendet Services

## 3. Phasen-DoD (Kurzfassung — ausführlich in ROADMAP.md)
1. **Platform Core** — DSP reproduzierbar (<1e-9), Serialisierung, CPU-Budgets definiert.
2. **Sync Engine** — Jitter < 0,1 ms, externer Sync, Multi-Modul-Integration.
3. **Project Runtime** — atomare Transaktionen, Autosave/Recovery, Schema-Konformität.
4. **Host Runtime** — Loader, Safe-Mode, I/O-Hot-Swap, Diagnostics.
5. **SDK** — externe Module laden, Thread-Safety-Matrix auto-getestet, Validator, 2 Beispiele.
6. **Groove** — sync-konsistente Step/Piano-Roll, Swing/Quant, dropout-freier Scene-Switch.
7. **FX Mix** — vollständige Mixer-Topologie, Realtime-FX, Metering.
8. **Synth** — Audio-Referenz-Vergleich, Modulation, Preset-Stabilität, Voice-Budget.
9. **Sample Forge** — Recording < 5 ms, artefaktarmes Stretch/Pitch, Vocoder/Looper sync.
10. **Remix** — Import, Stem-Trennung, nicht-destruktive Clips, verlustfreier Export.

## 4. Priorisierung nach Markt-Impact (Product Visionary)
- **Früher:** Phase 6 (Groove) ist das Alleinstellungsmerkmal — kann parallel zu Phase 3/4 vorbereitet werden, sobald Sync steht.
- Innovations-Backlog (KI-Remix-Vorschläge, Cloud-Assets) bleibt nachgelagert.

## 5. Cross-Cutting-Injekte (in jede Phase)
`03_DSP_Core` · `14_Testing` · `15_Performance` · `16_Security` · `17_Build_System` · `23_CI_CD` · `24_Hardware_Abstraction`.

## 6. Governance
Jede Phase durchläuft den Review-Zyklus (`CONTRIBUTING.md`). Scope-Änderungen nur per Change-Request.