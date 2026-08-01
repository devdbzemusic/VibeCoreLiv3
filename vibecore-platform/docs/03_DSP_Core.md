# 03 — DSP Core

> Phase/Doc 03 · Status: Draft v1.0 · Owner: Senior DSP/Algorithm Architect + Senior Audio Programmer · Review: 15-Rollen, 2/3-Mehrheit

## 1. Buffer-Verarbeitung
- **Block-Größe:** konfigurierbar (64/128/256/512), Referenz 256 @ 48 kHz.
- **Processing-Modell:** Pull — Host ruft `process(out, numFrames)` pro Block; Module lesen Input-Pins, schreiben Output-Pins.
- **Pin-Modell:** feste Kanalzahl pro Pin (deklariert im Manifest); kein dynamisches Kanal-Wachstum im Audio-Thread.
- **Scratch:** Thread-lokale Scratch-Buffer ≥ `numFrames × maxChannels × sizeof(float)`, vorallokiert.

## 2. SIMD-Pfade
| Plattform | Pfad | Fallback |
|---|---|---|
| x86-64 | AVX2 (8 float/Vec) | SSE2 → skalar |
| ARM64 | NEON (4 float/Vec) | skalar |
| ARM/SVE (optional) | SVE | NEON → skalar |
- Ein Vektor-Wrapper (`dsp::vec`) abstrahiert intrinsics; skalarer Pfad ist **immer** funktionsfähig und getestet.
- SIMD-Pfade werden in `tests/benchmarks` mit Referenz verglichen (Toleranz ≤ 1e-6).

## 3. Präzision & Numerik
- Default `float` (32-bit); `double` für Filter-Koeffizienten und Modulations-Mathematik bei Bedarf.
- **Anti-Denormal:** FTZ+DAZ pro Audio-Thread aktivieren; Makro `_mm_setcsr(_mm_getcsr() | 0x8040)` (x86) / entsprechende ARM-Maßnahmen; Tests mit Denormal-Input prüfen „kein Drop".
- **DC-Offset/Filter-Stabilität:** Koeffizienten clamped (|a|<1); saturierende Arithmetic wo möglich.

## 4. Modulations-Graph
- Parameter → DSP-Param über eine flache `ParamTable` (`ParamID → float`).
- UI schreibt atomar in `ParamSnapshot`; Audio liest Snapshot am Block-Anfang (Copy).
- Modulations-Quellen (LFO/Env) schreiben in denselben Snapshot — keine Ringbuffer-Kaskade im Audio-Pfad.
- Graph ist **acyclisch zur Block-Zeit**; Rückkopplungen nur über explizite Delay-Knoten (1 Block).

## 5. CPU-Budget-Matrix
| Modul-Klasse | Budget @ 48k/256 |
|---|---|
| Voice (Synth) | ≤ 3 % |
| FX (Reverb/Convolver) | ≤ 5 % |
| FX (Delay/Mod) | ≤ 2 % |
| Mixer/Routing | ≤ 2 % |
| Summe (Referenz-Set) | ≤ 50 % (single core) |
Verletzung ⇒ Runtime-Warning + CI-Gate (Benchmark-Regression < 5 %).

## 6. Determinismus-Test
- `tests/unit` vergleicht `process()`-Output gegen goldene Referenz (`tests/reference_audio`) byteweise (Toleranz ≤ 1e-9).
- Seed-basierte RNG für Humanize; kein `rand()`/`chrono` im DSP-Block.

## 7. Fehler im DSP-Path
- Keine Exceptions; NaN/Inf werden zu 0.0 gesättigt (Defensive Saturator am Knoten-Output).
- Modul-Crash ⇒ Safe-Mode (siehe `06_Host_Runtime.md`) — Knoten bypass, nicht Host-Absturz.