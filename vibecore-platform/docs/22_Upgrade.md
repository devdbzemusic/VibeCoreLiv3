# 22 — Upgrade

> Phase/Doc 22 · Status: Draft v1.0 · Owner: Senior Product Visionary + Senior UX Architect · Review: 15-Rollen, 2/3-Mehrheit

## 1. Von VibeCoreLiv2 → Liv3
-Projekt-Import via Converter (Liv2 → Liv3-Schema); Verlust-Protokoll (nicht übertragbare Features dokumentiert).
- Preset-Konvertierung; Re-Binding veralteter Modul-IDs.

## 2. Benutzer-Kommunikation
- Upgrade-Dialog: Was ändert sich, was bleibt, was muss migriert werden.
- Release-Notes pro Version (`releases/Release_Notes/`).

## 3. UX-Grundsätze beim Upgrade
- Keine automatische Zerstörung alter Daten (Backup zuerst).
- Progressiv: Import-Preview vor Commit.
- Rollback-Möglichkeit dokumentiert (`18_Deployment.md`).

## 4. Kompatibilitäts-Hinweise
- VST/AU-Host-Integration: Host-Update prüfen.
- Hardware: Treiber-Mindestversionen (`24_Hardware_Abstraction.md`).

## 5. Support-Pfad
- Upgrade-Probleme über Change-Request-Kanal; kein direkter Eingriff in Daten ohne Zustimmung.