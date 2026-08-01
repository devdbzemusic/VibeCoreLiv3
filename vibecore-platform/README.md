# VibeCoreLiv3 — Platform

> Modulare, deterministische Audio-Plattform: nativer C++-Kern, zentrale Sync-Engine, Projekt-/Host-Runtime, öffentliches SDK.
> **Status:** Baseline v1.0 · Freigegeben durch 15-Rollen-Review (12 Ja, 2 Enthaltungen, 1 Ablehnung → Change-Request Phase 10).

VibeCoreLiv3 trennt konsequent zwischen **Platform Core**, **Sync Engine**, **Project Runtime**, **Host Runtime** und **SDK**. Im Gegensatz zu klassischen DAWs definiert ein zentraler deterministischer Kern die Zeitbasis, und kein Modul darf eine eigene Uhr besitzen.

## Architektur-Überblick (5 Schichten)

| Schicht | Phase | Verantwortung |
|---|---|---|
| Platform Core | 1 | DSP-Graph, Routing, Projekt/Preset/Asset, Undo/Redo, Diagnostics |
| Sync Engine | 2 | BPM, Transport, Song Position, Clock-Distribution, externer Sync |
| Project Runtime | 3 | Project/Scene/Pattern, Autosave, Recovery, Transaktionen |
| Host Runtime | 4 | Host, Module-Loader, Audio/MIDI-I/O, Safe Mode, Crash-Recovery |
| SDK | 5 | C-ABI, Wrapper, Validator, Beispiele für Drittentwickler |
| Groove / FX / Synth / Sample / Remix | 6–10 | Musikalischer & kreativer Performance- und Produktions-Core |

## Nicht verhandelbare Grundsätze (Auszug)
- **Echtzeit-Disziplin:** Audio-Thread frei von Locks, Allokationen, I/O, `std::function`, `std::map`, virtuellen Aufrufen.
- **Determinismus:** gleicher Input + gleiche Zeitbasis ⇒ identisches Sample (Toleranz ≤ 1e-9).
- **Zeitbasis:** ausschließlich VibeCore Sync — kein Modul mit eigener Uhr.
- **Performance-Budget:** ≤ 5 % CPU pro Modul bei 48 kHz / 256 Samples.
- Vollständige Regeln: `CODING_STANDARD.md` und Abschnitt 2 des Masterplans.

## Build
```bash
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build -j
ctest --test-dir build --output-on-failure
```
**Toolchain:** C++20 · CMake ≥ 3.22 · Catch2/GoogleTest · Compiler: MSVC 2022, Clang 16, GCC 13. **Plattformen:** Windows 10+, macOS 12+, Ubuntu 22.04+.

## Repository-Map
```
vibecore-platform/
├── README.md  ROADMAP.md  CHANGELOG.md  CONTRIBUTING.md
├── CODING_STANDARD.md  LICENSE.md
├── docs/         # 00–24: Vision, Blueprint, Architektur, DSP, Sync … Hardware-Abstraktion
├── diagrams/     # PlantUML/Mermaid-Quellen (architecture/dsp/runtime/ui/sync/sdk)
├── schemas/      # JSON-Schemas: project, preset, asset, module, scene
├── specs/        # api/dsp/sdk/threading/realtime/file_formats
├── tests/        # unit/integration/realtime/regression/benchmarks/reference_audio
├── ci/  scripts/  docker/  releases/  assets/  examples/  tools/
└── src/          # core/modules/sdk/platform
```

## Team & Governance
15 Principal/Architect-Rollen prüfen jede Entscheidung; 2/3-Mehrheit der abgegebenen Stimmen; Ablehnung muss mit Alternative begründet werden. Change-Requests durchlaufen denselben Zyklus. Siehe `CONTRIBUTING.md` und `docs/01_Blueprint.md`.

## Einstieg
1. `docs/00_Vision.md` — Produktvision & kreative Leitlinie
2. `docs/01_Blueprint.md` — Phasen-Modell & Abhängigkeitsmatrix
3. `docs/02_Architecture.md` — Layer, Datenflüsse, Thread-Modell
4. `CODING_STANDARD.md` — verbindliche Echtzeit- & Speicherregeln
5. `ROADMAP.md` — Meilensteine & DoD