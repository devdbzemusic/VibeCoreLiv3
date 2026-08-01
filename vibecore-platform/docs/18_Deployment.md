# 18 — Deployment

> Phase/Doc 18 · Status: Draft v1.0 · Owner: Senior DevOps Architect · Review: 15-Rollen, 2/3-Mehrheit

## 1. Release-Zyklen
- **Major** (API-Bruch) · **Minor** (Features, ABI-stabil) · **Patch** (Fixes).
- Baseline-Release taggt alle Komponenten gemeinsam (Core/SDK/Module/Doku).

## 2. Baseline & Rollback
- Jede Baseline archiviert (Git-Tag + PDF-Exemplar in `releases/`).
- **Rollback:** vorherige Baseline lauffähig; Projekt-Migration rückgängig dokumentiert (`21_Migration.md`).
- Release-Notes pro Version in `releases/Release_Notes/`.

## 3. Installation
- Plattform-Installer (Win MSI/macOS pkg/Linux deb+rpm+AppImage).
- Signierte Installer; Checksum-Veröffentlichung.

## 4. Staging-Umgebungen
- `dev` → `staging` → `release-candidate` → `release`.
- RC durchläuft volle QA-Matrix (`14_Testing.md`) vor `release`.

## 5. Observability im Feld (opt-in)
- Crash-Reports (anonymisiert), Performance-Telemetrie (Jitter/Dropout-Histogramm) → DevOps-Dashboards (`23_CI_CD.md`).

## 6. Disaster-Recovery
- Project Runtime Recovery (`05_Project_Runtime.md`); lokale Versions-Historie.
- Wichtige Konfigurationen versionierbar; Reset-on-Corrupt.