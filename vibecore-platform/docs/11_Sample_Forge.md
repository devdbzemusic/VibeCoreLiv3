# 11 — Sample Forge & Voice

> Phase/Doc 11 · Status: Draft v1.0 · Owner: Senior Technical Sound Designer + Senior Audio Programmer · Review: 15-Rollen, 2/3-Mehrheit

## 1. Recorder
- **Latenz-Ziel < 5 ms** (Input→Buffer). Direkter Pufferzugriff über Host-I/O; kein File-Write im Audio-Thread.
- Pre-Roll/Count-in; Take-Management (best Takes, comping).
- Auto-Gain optional; Monitoring-Latenz dokumentiert.

## 2. Editor
- Nicht-destruktiv: Edits als Operationen auf Asset-Referenzen (Start/End/Slices/Loop).
- **Pitch/Time-Stretch:** artefaktarm (Phase-Vocoder/Granular/WSOLA je nach Modus); Quality-Presets (low/medium/high).
- **Slices:** Beat-Grid-Detektion → Slice-Markers; Trigger als Step- oder Pad-Quelle.
- **Wave-Edit:** reverse, normalize, fade in/out, freeze (spectral), granular params.

## 3. Voice (Vocoder & Formant)
- Vocoder band-bank (analyser → carrier), Formant-Shift; sync-korrekt (Phase-Lock zur Sync-Engine).
- Voice-Modell: Pitch-Tracking, Breath-Noise; CPU-Budget dokumentiert.

## 4. Looper
- Multi-Loop, sync-korrekt (Loop-Länge = `N * bar`); Beat-Auto-Quantize; Feedback/Overdub.
- Loop-Switch ohne Dropout (Pre-Crossfade vorallokiert).

## 5. Asset-Integration
- Samples als `asset_id` referenziert (`schemas/asset.schema.json`); Inhalt im Asset-Store.
- Integrität: SHA-256 + Manifest beim Laden (siehe `16_Security.md`).

## 6. Workflow „Aufnehmen → Bearbeiten → Verwenden → Speichern"
1. **Aufnehmen:** Recorder-Take → Asset.
2. **Bearbeiten:** Editor-Operationen (nicht-destruktiv) → Wave-Edit-Params.
3. **Verwenden:** Part-Source = sample/hybrid; Slice-Trigger im Step/Piano-Roll.
4. **Speichern:** Projekt/Preset referenziert Asset-ID; Preset inkludiert ggf. Wave-Edit-State.

## 7. Tests
- `tests/realtime`: Recording-Latenz-Messung (<5 ms), Loop-Stabilität.
- `tests/regression`: Stretch/Pitch-Qualität (Spektrogramm-Vergleich) + Vocoder-Referenz.