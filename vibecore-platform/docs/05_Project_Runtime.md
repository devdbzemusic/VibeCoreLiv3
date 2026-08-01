# 05 — Project Runtime

> Phase/Doc 05 · Status: Draft v1.0 · Owner: Senior Software System Architect · Review: 15-Rollen, 2/3-Mehrheit

## 1. Datenmodell
```
Project ─► Pattern[] ─► Scenes[1..8] ─► Steps / Notes (per Part)
            └── length (shared per scene), swing, seed
```
- **Pattern = PatternPart** (Spec). Szene trägt Länge (2..16), geteilt von allen Parts derselben Szene. Polymetrik zwischen Szenen, nicht zwischen gleichzeitigen Parts.
- Persistiert als `schemas/project.schema.json`; Presets als `schemas/preset.schema.json`.

## 2. Transaktionen
- Alle Änderungen atomar (Commit/Rollback); kein partieller Zustand sichtbar.
- **Undo/Redo:** Command-Stack; jede Aktion ist invertierbar; Begrenzung konfigurierbar.

## 3. Autosave & Recovery
- **Autosave:** Intervall (Default 30 s) + bei Idle; asynchron über File-I/O-Thread.
- **Crash-Recovery:** beim Start wird letztes Autosave erkannt;用户 wählt Wiederherstellen/Verwerfen.
- **Integrität:** jede Projektdatei trägt SHA-256-Hash + Manifest-Signatur (siehe `16_Security.md`).

## 4. Versionierung & Migration
- Projektformat-versioniert (`schemaVersion`); alte Formate werden über `21_Migration.md`-Pfade konvertiert oder kontrolliert abgelehnt.
- Versions-Historie (Commits) lokal; konfliktfrei (single-user baseline).

## 5. Assets
- Samples/Preset-Blobs referenziert via `asset_id`; Inhalt im Asset-Store, nicht in der Projektdatei (Feldgrößen-Limit).
- Asset-Manifest prüft Integrität beim Laden.

## 6. Fehler-Policy
- Korrupte Projektdatei ⇒ Recovery-Dialog, nicht Absturz; Fallback auf letzte intakte Baseline.
- Schema-Verletzung ⇒ Migration versuchen, sonst Ablehnung mit Begründung.

## 7. Tests
- `tests/integration`: Transaktion-Rollback, Autosave-Wiederherstellung, Schema-Roundtrip.
- `tests/regression`: alte `schemaVersion` → neue konvertiert.