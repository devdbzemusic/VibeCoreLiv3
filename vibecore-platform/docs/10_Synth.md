# 10 — Synth & Bass

> Phase/Doc 10 · Status: Draft v1.0 · Owner: Senior Technical Sound Designer + Senior DSP Architect · Review: 15-Rollen, 2/3-Mehrheit

## 1. Voice Core
- Polyphone Voice-Allokation (Voice-Stealing-Policy dokumentiert); Voice-Pool vorallokiert.
- CPU-Budget pro Voice ≤ 3 % bei N Stimmen (N in `15_Performance.md`).
- Synth + Sample first-class kombinierbar (Hybrid — siehe `11_Sample_Forge.md`).

## 2. Oszillator
- Morph (Sine→Saw→Square), FM (Amount + Ratio), Noise-Anteil, Unison/Detune/Spread, Sub.
- Anti-Aliasing (PolyBLEP / BLAMP); Sample-accurate Phase.

## 3. Filter
- SVF (Lowpass/Bandpass/Highpass/Notch), Resonance, Drive; Filter-Envelope (ADSR).

## 4. Amplifier & Modulation
- Amp-Envelope (ADSR), Velocity, Keytrack.
- **Modulation:** LFO (multi-shape), Envelope, Motion-Sequencer (siehe `08_Groove.md`) → ParamTable.
- Modulations-Graph acyclisch zur Block-Zeit (siehe `03_DSP_Core.md`).

## 5. Stereo / Spatial
- Stereo-Spread, Binaural-Option (HRTF) als FX-Modul; Width im Master begrenzt.

## 6. Presets & Layering
- Preset-Versionierung (`schemas/preset.schema.json`); Layer = geordnete Stimmenliste.
- **Workflow:** Aufnehmen → Bearbeiten → Verwenden → Speichern (Preset = Synth-State + ggf. Sample-Ref).
- Preset-Migration bei DSP-Version-Wechsel (`21_Migration.md`).

## 7. Tests
- `tests/regression`: Synth-Referenz-Sounds (Audio-Vergleich, Toleranz ≤ 1e-6).
- `tests/realtime`: Voice-Stealing unter Druck, keine Dropout.
- Preset-Roundtrip: speichern → laden → audio-identisch.