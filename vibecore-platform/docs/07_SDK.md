# 07 — SDK

> Phase/Doc 07 · Status: Draft v1.0 · Owner: Senior Software System Architect + Senior Audio Tools Architect · Review: 15-Rollen, 2/3-Mehrheit

## 1. C-ABI
- Stabiles C-Interface (`vibecore_sdk.h`): Modul-Factory, Pin-Deskriptoren, `process()`-Signatur, QueryInterface.
- **Keine C++-Symbole über ABI** → Compiler/STL-unabhängig nutzbar (Rust, Zig, C, C++).
- Versionierung: `VK_SDK_API_VERSION`; Host lehnt abweichende Major-Versionen ab.

## 2. Ownership & Semantik
- **Ownership:** Host besitzt Buffer & Graph; Modul besitzt seine internen State-Pools.
- **Buffer:** non-owning Zeiger (Audio-Thread), gültig nur während `process()`.
- **Fehler:** Status-Codes (`kError*`), keine Exceptions über ABI.
- **Lebensdauer:** `init()` allokiert Pools; `deactivate()` vor `unload()`; kein Heap in `process()`.

## 3. Thread-Safety-Matrix
| Aufruf | UI-Thread | Audio-Thread | Worker |
|---|:---:|:---:|:---:|
| `create/destroy` | ✓ | ✗ | ✓ |
| `setParam(snapshot)` | ✓ (atomic) | ✗ (nur Read) | ✓ |
| `process()` | ✗ | ✓ | ✗ |
| `getState()` | ✓ | ✓ (Read) | ✓ |
- Auto-Test im CI: Instrumentierung prüft, dass `process()` nur vom Audio-Thread aufgerufen wird.

## 4. Realtime-Validator
- Statische Analyse (clang-based) erkennt verbotene Symbole/Pattern im Audio-Pfad (`malloc`, `std::function`, mutex, vtable in hot loops).
- Laufzeit-Hook (Debug) detektiert Heap-Allokation in `process()`.
- Validator ist **CI-Gate**: Modul ohne grünen Validator wird nicht geladen.

## 5. Wrapper & Beispiele
- Wrapper: C++, Rust (geplant), Python (nur Offline/Analysis — nie Audio-Thread).
- `examples/`: ≥ 2 Beispiele — (a) Tone-Generator, (b) Simple-Delay — funktionsfähig & validiert.

## 6. Sicherheit
- Modul-Manifest signiert; Drittmodule in Sandbox (eingeschränkte Asset-/Netz-Rechte) — siehe `16_Security.md`.
- Berechtigungsmodell: Modul deklariert Ressourcenbedarf; Host gewährt/verweigert.

## 7. Tools
- **Inspector** — Modul-Graph + Live-Metriken.
- **Profiler** — Block-Weise CPU-Messung.
- **Validator** — Realtime- & Schema-Check.
- **Offline-Analyse** — Latenz-kritischer Pfade (siehe `15_Performance.md`).