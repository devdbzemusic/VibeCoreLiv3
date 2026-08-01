# 19 — API Reference

> Phase/Doc 19 · Status: Draft v1.0 · Owner: Senior Software System Architect · Review: 15-Rollen, 2/3-Mehrheit

## 1. Status
Auto-generiert aus Header-Doc-Kommentaren (Doxygen/clang-doc). Diese Datei ist ein Index; kanonische Quelle = `src/sdk/vibecore_sdk.h` + `specs/api/`.

## 2. Core-Header
- `vibecore_sdk.h` — C-ABI, Modul-Factory, Pins, `process()`, QueryInterface.
- `vibecore_sync.h` — `getStateAt(audioTime)`, `setTempo`, `alignDownbeat`, `nextDivisionAt`.
- `vibecore_graph.h` — Knoten/Pin-Verwaltung, Routing, Bypass.
- `vibecore_project.h` — Project/Scene/Pattern CRUD, Transaktionen, Undo/Redo.

## 3. Konventionen
- Status-Codes: `kErrorNone|kErrorOutOfMemory|kErrorInvalidParameter|kErrorNotImplemented|kErrorFormat|kErrorIntegrity`.
- Ownership: dokumentiert pro Funktion (`in`/`out`/`transfer`).
- Thread-Safety: Matrix in `07_SDK.md`; Funktionen tragen Annotation.

## 4. Lebenszyklus
```
load(id) → init(manifest) → activate(samplerate, blockSize) → process(...) → deactivate → unload
```

## 5. Beispiele
- `examples/tone_generator/` — Minimal-Modul (Sine).
- `examples/simple_delay/` — Delay + Ringbuffer + Sync-Quantize.

## 6. Generierung
- CI erzeugt HTML + Markdown-Export nach `specs/api/` bei jedem Tag.