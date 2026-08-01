# 14 — Testing

> Phase/Doc 14 · Status: Draft v1.0 · Owner: Senior Audio QA & Test Architect · Review: 15-Rollen, 2/3-Mehrheit

## 1. Test-Pyramide
| Ebene | Zweck | Framework |
|---|---|---|
| **Unit** | DSP-Block, Pure-Funktionen | Catch2/GoogleTest |
| **Integration** | Modul-übergreifend, Graph | Custom + Catch2 |
| **Realtime** | Jitter, Dropout, Dauerlast | Custom Harness |
| **Regression** | Referenz-Audio-Vergleich | Bit/Sample-Vergleich |
| **Benchmarks** | CPU-Budget pro Modul | Google-Benchmark |

## 2. Toleranz-Schwellen
- **Determinismus (DSP):** ≤ 1e-9 (byteweise wo möglich).
- **SIMD vs. Skalar:** ≤ 1e-6.
- **Mix/Peak/RMS:** ±0,1 dB; Sample-Position ±1 Sample.
- **Jitter (Sync):** P95 < 0,1 ms @ 48 kHz.
- **Recording-Latenz:** < 5 ms.

## 3. Fuzzing
- **Modul-Input-Fuzzing:** zufällige/zulässige/extreme Parameter-Sets, NaN/Inf/Denormal, leere/volle Buffer.
- **Deserialisierungs-Fuzzing:** korrupte Projekt/Asset-Dateien → kontrollierte Ablehnung (kein Crash).
- **ABI-Fuzzing:** ungültige `api_version`/Pin-Konfigurationen.

## 4. Regression & Referenz-Audio
- Goldene Referenzen in `tests/reference_audio/` (versioniert).
- Regression: `process()`-Output vs. Referenz (Sample-Vergleich).
- Bei Algorithmus-Wechsel (DSP-Version) Referenz bewusst aktualisieren + `CHANGELOG.md`.

## 5. CI-Gates
- **Merge requires:** Unit + Integration + Realtime grün · Validator 0 Verstöße · Benchmark-Regression < 5 % · Coverage ≥ 70 % auf `src/core` · Kein neuer Jitter-Warn.
- Platform-Matrix: Windows (MSVC), macOS (Clang), Linux (GCC).

## 6. Akustik-QA (Akustik-Architekt)
- Referenz-Hörraum dokumentiert (kalibriertes Stereo, Sweet-Spot, Nachhallzeit).
- Listening-Tests für Preset-/FX-QA (definierte Referenz-Tracks).

## 7. Dauerlast
- 60 min @ voller Stimmenlast, Scene-Switching, I/O-Hot-Swap → Dropout-Count 0, Memory stabil.