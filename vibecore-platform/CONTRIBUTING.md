# CONTRIBUTING — VibeCoreLiv3

## Branch-Strategie
- `main` — stets grüne, freigegebene Baseline (getaggt).
- `phase/<n>-<slug>` — Phasen-Arbeitszweige.
- `feature/<slug>`, `fix/<slug>`, `docs/<slug>` — kurze, fokussierte Zweige.
- `cr/<id>-<slug>` — Change-Request-Zweige.
- Rebase-Modus; kein direktes Push auf `main`. Squash-Merges mit Verweis auf Ticket + Review-Votum.

## Commit-Konvention (Conventional Commits)
```
<type>(<scope>): <subject>

<footer>
```
- **type:** `feat|fix|docs|refactor|perf|test|build|ci|chore|sec`
- **scope:** Phase oder Modul (z.B. `sync`, `dsp`, `sdk`, `phase6`)
- Footer: `Reviewed-by:` (≥2 Rollen), `Governance: <2/3>`, ggf. `Refs: #CR-xxx`.

## Review-Kriterien (alle 15 Rollen)
1. Echtzeit-Disziplin (keine Locks/Allok/`std::function`/`std::map`/vtable im Audio-Thread).
2. Determinismus (reproduzierbar, Toleranz ≤ 1e-9).
3. Sync-Konformität (keine eigene Zeitbasis).
4. CPU-Budget & Speicher-Policy.
5. Fehler-/Sicherheits-/Dokumentations-Standard.
6. Test-Abdeckung & Referenz-Audio wo anwendbar.

## Governance-Zyklus
1. Erstellung durch Fachautor.
2. Peer-Review durch 2 andere Rollen (nicht Autor).
3. Architektur-Review (alle 15 Rollen).
4. Abstimmung (Zustimmung / Ablehnung m. Begründung / Enthaltung) — **2/3-Mehrheit** der abgegebenen Stimmen.
5. Freigabe durch Senior Product Visionary (Gatekeeper).
6. Archivierung (Tag/Baseline) + PDF-Release-Exemplar.

## Scope-Änderungen
Nur über Change-Request (`cr/`), derselbe Zyklus. Keine PoC-Änderungen ohne Freigabe.

## DoD pro Arbeitspaket
- Tests parallel (TDD) · Realtime-Verstöße = 0 · DoD der jeweiligen Phase erfüllt · Doku aktualisiert · `CHANGELOG.md` ergänzt.