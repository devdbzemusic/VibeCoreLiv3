# 15 — Performance

> Phase/Doc 15 · Status: Draft v1.0 · Owner: Senior Audio Programmer + Senior Audio Tools Architect · Review: 15-Rollen, 2/3-Mehrheit

## 1. Metriken
- **CPU** pro Modul & gesamt (single-core Referenz) · **Memory** (Pools, Arenen) · **Jitter** (P50/P95/P99) · **Dropout-Count** · **Buffer-Underrun** · **Voice-Count**.

## 2. Profiling
- Block-weise CPU-Messung (Profiling-API `07_SDK.md`).
- Offline-Analyse-Tools für latenz-kritische Pfade (`tools/`).
- Flamegraph-fähige Tracing-Events (Debug-Builds).

## 3. Budgets (Referenz @ 48 kHz / 256 / single core)
- Voice ≤ 3 % · FX-Reverb ≤ 5 % · FX-Delay/Mod ≤ 2 % · Mixer/Routing ≤ 2 % · Summe Referenz-Set ≤ 50 %.
- Verletzung ⇒ CI-Gate (Regression < 5 %) + Diagnostics-Warning.

## 4. Jitter-Management
- Look-ahead-Scheduling; grid-aligned Switching (kein Flam).
- Audio-Thread höchste Priorität; main-thread Jitter vom Scheduler getrennt (vgl. VibeCore Engine-Gating).
- P95 < 0,1 ms @ 48 kHz.

## 5. Plattformvergleiche
- Windows (ASIO/WASAPI), macOS (CoreAudio), Linux (ALSA/PipeWire).
- Latenz-Budget pro Treiber dokumentiert (`24_Hardware_Abstraction.md`).

## 6. Observability
- Strukturiertes Logging (Info/Warning/Critical), niemals im Audio-Thread formatiert (Pre-format, Ringbuffer).
- Metrics-Export (opt-in) an DevOps-Dashboards (`23_CI_CD.md`).

## 7. Regression-Gate
- Benchmark-Regression > 5 % blockt Merge; Abhilfe: Optimierung oder bewusste Budget-Anpassung (`CHANGELOG.md`).