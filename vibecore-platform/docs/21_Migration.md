# 21 — Migration

> Phase/Doc 21 · Status: Draft v1.0 · Owner: Senior Software System Architect · Review: 15-Rollen, 2/3-Mehrheit

## 1. Versions-Übergänge
- Projektformat versioniert (`schemaVersion`). Host unterstützt N und N-1; älter → Migration oder kontrollierte Ablehnung.
- API/DSP-Version-Major-Bruch ⇒ Migrationspfad dokumentiert.

## 2. Daten-Migration
- **Projekt:** `schemas/project.schema.json` v(N-1) → v(N) via versionierter Migrationsfunktion; idempotent.
- **Preset:** `schemas/preset.schema.json` bei DSP-Version-Wechsel; ggf. Re-Render-Referenz aktualisieren.
- **Asset:** Hash-Stabilität; bei Re-Encoding neuer Hash + Manifest-Eintrag.

## 3. Kompatibilität
- ABI stabil innerhalb Major; Module erklären `api_version`; Host lehnt inkompatibel ab (Dialog, nicht Crash).
- „N und N-1"-Policy; N-2 nur mit explizitem Converter.

## 4. Migrations-Test
- `tests/regression`: alte Schema-Version → neue konvertiert → semantisch äquivalent (Peak/RMS ±0,1 dB).
- Roundtrip: neu → alt (sofern verlustfrei möglich) → diff.

## 5. Rollback
- Migration schreibt Backup (`*.bak.vN`); Benutzer kann verwerfen.
- Siehe `18_Deployment.md` Baseline-Rollback.

## 6. Upgrade-Pfade für Benutzer → `22_Upgrade.md`.