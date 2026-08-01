# CHANGELOG — VibeCoreLiv3

Format: [Keep a Changelog](https://keepachangelog.com/); Semantic Versioning. Architektur-, API- und Dokumentänderungen werden versioniert; nur freigegebene Baselines werden archiviert.

## [1.0.0] — 2026-07-28 — Initial Baseline
### Hinzugefügt
- Masterplan & Repository-Blueprint (5 Schichten, 10 Phasen, 24 Doku-Module).
- Nicht verhandelbare Grundsätze: Echtzeit-Disziplin, Determinismus, Zeitbasis, Performance-Budgets (≤ 5 %/Modul @ 48 kHz/256).
- Repository-Gerüst: `docs/`, `schemas/`, `specs/`, `tests/`, `diagrams/`, `ci/`, `scripts/`, `docker/`, `src/`.
- JSON-Schemas: project, preset, asset, module, scene.
- Neue Querschnitts-Dokumente: `21_Migration`, `22_Upgrade`, `23_CI_CD`, `24_Hardware_Abstraction`.
- Governance: 15-Rollen-Review, 2/3-Mehrheit, Change-Request-Prozess.
### Freigabe
- 12 Ja · 2 Enthaltungen · 1 Ablehnung (Phase 10 Detailtiefe → Change-Request #CR-001).
### Bekannte Change-Requests
- `#CR-001` — Phase 10 (Remix): Stem-Trennung & Export-Genauigkeit detaillierter spezifizieren (Ziel v1.1).