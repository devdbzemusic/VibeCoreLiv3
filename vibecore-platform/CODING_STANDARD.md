# CODING_STANDARD — VibeCoreLiv3

Verbindlich für alle Module und Phasen. Verstöße gegen Echtzeit-/Speicherregeln blocken den Merge (CI-Validator).

## 1. Echtzeit-Disziplin (Audio-Thread)
**Verboten im Audio-Thread:** Locks/Mutex · Heap-Allokation (`new`/`malloc`/`std::vector`-Wachstum) · Datei-/Netzwerk-I/O · Logging-Spitzen/Formatierung · `std::function` · `std::map`/`std::unordered_map` · dynamische virtuelle Aufrufe (vtable indirection in hot loops) · `printf`/`std::cout` · `std::shared_ptr`-Refcount-Contention.
**Erlaubt:** statische Dispatch-Tables · compile-time polymorphism (CRTP/`if constexpr`) · vorallokierte Pools/Arenen/Scratch-Buffer · Lock-free SPSC-Ringbuffer · atomare Parameter-Flags.

## 2. Lock-Free-Strategie
- **Audio ↔ UI:** SPSC-Ringbuffer (single-producer/single-consumer) für Parameter-Events und Meter-Snapshots.
- **Parameter-Update:** UI schreibt atomar in einen `ParamSnapshot`; Audio liest diesen per `acquire` am Block-Anfang (Copy, nicht Referenz).
- **Nie** mutex/condition_variable im Audio-Pfad. Wo Synchronisation nötig, dokumentiere in `07_SDK.md` Thread-Safety-Matrix.

## 3. Speicher-Policy
- Vorallokation in Pools/Arenen beim Modul-Setup; kein Wachstum zur Laufzeit.
- Scratch-Buffer pro Block wiederverwendet (Thread-lokal, fixe Größe ≥ Block-Samples × max-Kanäle).
- Lifetime: klare Ownership (Owner = Host oder Modul); `unique_ptr` nur außerhalb Audio-Thread; rohe Zeiger/Referenzen in Audio-Funktionen (non-owning).

## 4. Determinismus
- Gleicher Input + gleiche Zeitbasis ⇒ identisches Sample, Toleranz ≤ 1e-9.
- Kein `rand()` im Audio-Pfad — deterministische RNG (seed-basiert) für Humanize/Swing.
- Keine systemzeitabhängigen Berechnungen im DSP-Block.

## 5. DSP / Numerik
- Default: `float` (32-bit); `double` nur für Filter-Koeffizienten & Modulations-Mathematik bei Bedarf.
- **Anti-Denormal:** Flush-to-zero (FTZ/DAZ) pro Audio-Thread aktivieren + Makros/`_mm_setcsr`; Tests mit Denormal-Input.
- SIMD-Pfade: AVX2 (x86), NEON (ARM), SVE (optional) — skalarer Fallback dokumentiert.
- Modulations-Graph: Parameter → DSP-Param über eine flache `ParamTable` (ID → Wert), aktualisiert als Snapshot am Block-Anfang.

## 6. Fehler-Policy
- Fehlerklassen: `kErrorNone|kErrorOutOfMemory|kErrorInvalidParameter|kErrorNotImplemented|kErrorFormat|kErrorIntegrity`.
- Keine Exceptions über ABI-Grenzen; Rückgabewerte/Out-Params.
- Recovery-First: fangen, Zustand zurücksetzen, User informieren; kein `abort` im Audio-Thread.

## 7. Performance-Budget
- ≤ 5 % CPU pro Modul @ 48 kHz / 256 Samples (single core reference).
- Verletzung ⇒ Compile-Time-Assertion (constexpr-Budget-Check wo möglich) oder Runtime-Warning im Diagnostics-Inspector.

## 8. Namens- & Style-Regeln
- `PascalCase` Typen, `camelCase` Funktionen/Variablen, `kPascalCase` Konstanten, `m_` Prefix für Member (oder konsequent ohne — siehe Modul-Styleguide).
- Header-Guards via `#pragma once`; Include-Order: eigene → Projekt → Third-Party → System.
- `[[nodiscard]]` für Status-Rückgaben; `noexcept` für Audio-Path-Funktionen.

## 9. CI-Enforcement
- Static Analysis (clang-tidy, MISRA-Subset) · Realtime-Validator (statische Heuristik: erkennt verbotene Symbole im Audio-Pfad) · Sanitizer (ASan/UBSan/TSan in Debug) · CPU-Benchmark-Regression < 5 %.