# 23 — CI/CD

> Phase/Doc 23 · Status: Draft v1.0 · Owner: Senior DevOps / Platform Reliability Architect · Review: 15-Rollen, 2/3-Mehrheit

## 1. Pipeline-Übersicht
```
push/PR → lint → build (matrix) → unit → integration → realtime → benchmark → validator → coverage → stage
tag → release-candidate → QA-matrix → release (sign + archive)
```

## 2. Konfiguration
- `ci/build.yml`, `ci/test.yml`, `ci/release.yml` (GitHub Actions / GitLab CI).
- Container-Builds (`docker/`) für reproduzierbare Linux-Jobs.

## 3. Gates (merge-blockierend)
- Unit + Integration + Realtime grün · Validator 0 Verstöße · Benchmark-Regression < 5 % · Coverage ≥ 70 % (`src/core`) · Static-Analysis clean · kein neuer Jitter-Warn.

## 4. Staging & Release
- `dev` → `staging` → `release-candidate` → `release`.
- Signierte Artefakte (Installer + Checksum); Archiv in `releases/` + Tag.

## 5. Observability
- Metrics-Export (opt-in) → Dashboards (CPU/Jitter/Dropout über Builds).
- Logging strukturiert; Alerts bei Benchmark-Regression oder Jitter-Spike.

## 6. Disaster-Recovery
- Reproduzierbare Builds (Lockfile + Container); Rollback zu Tag.
- CI-Secrets im Vault; keine Secrets in Logs.

## 7. Automatisierung
- Auto-Generierung API-Referenz (`19_API_Reference.md`) bei Tag.
- Auto-Update `CHANGELOG.md` aus Conventional-Commits.