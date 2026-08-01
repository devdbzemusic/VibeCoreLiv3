# 13 — Remix

> Phase/Doc 13 · Status: Draft v1.0 · Owner: Senior Product Visionary + Senior Audio Programmer · Review: 15-Rollen, 2/3-Mehrheit (v1.0 freigegeben trotz CR-001 Detailtiefe)

## 1. Import
- Formate: WAV, AIFF, MP3 (decode asynchron über Worker-Thread).
- Metadaten-Extraktion: BPM, Key, Länge, Tags (für Sample-Tagging `12_AI.md`).
- Integritätsprüfung der Datei vor Decodierung.

## 2. Analyse
- Onset/Beat-Detektion (vgl. VibeCore Sync) → Tempo- & Downbeat-Schätzung.
- **Stem-Trennung:** via SDK-Modul oder extern (Innovations-Backlog); Schemas für Stem-Bundles (`schemas/asset.schema.json`).
- Key-Detection (chroma-basiert).

## 3. Clip-Engine
- **Nicht-destruktiv:** Clips referenzieren Asset-Regionen (start/end/pitch/stretch).
- Warp/Quantize; Beat-Mapping an Sync `phase01`.
- Multi-Clip-Arrangement; polyrhythmische Clips via Sync.

## 4. Export
- **Stems:** einzelne Busse verlustfrei (32-bit float WAV).
- **Mixdown:** 16/24-bit, wählbar; Loudness-Target (LUFS) optional.
- Verlustfrei = kein erneutes Lossy-Encoding außer explizit gewünscht.

## 5. CR-001 (Change-Request, v1.1)
- Stem-Trennung: explizite Qualitätsschwellen (SDR-Ziel, Artefakt-Grenzen) definieren.
- Export-Genauigkeit: Bit-perfect-Roundtrip-Test (WAV → Remix → Export → Vergleich).
- Siehe `CHANGELOG.md`.

## 6. Tests
- `tests/integration`: Import → Clip → Export Roundtrip (Peak/RMS ±0,1 dB).
- `tests/regression`: Referenz-Remix-Projekt.