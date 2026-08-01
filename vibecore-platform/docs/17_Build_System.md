# 17 — Build System

> Phase/Doc 17 · Status: Draft v1.0 · Owner: Senior Software System Architect + Senior DevOps Architect · Review: 15-Rollen, 2/3-Mehrheit

## 1. CMake-Strategie
- CMake ≥ 3.22, C++20. Modular via `add_subdirectory`; `vibecore_core`, `vibecore_sdk`, `vibecore_modules`, `vibecore_platform_*`.
- Targets: `vibecore_core` (static), `vibecore_host` (exe), `vibecore_sdk_test`, `examples/*`.

## 2. Compiler-Matrix
| Plattform | Compiler | Flags |
|---|---|---|
| Windows | MSVC 2022 `/std:c++20 /permissive-` | `/O2 /fp:fast` (nur DSP) mit Guarded-Roundtrip |
| macOS | Clang 16 `-std=c++20` | `-O3`, NEON-nativ auf ARM64 |
| Linux | GCC 13 `-std=c++20` | `-O3 -march=native` (CI: `-march=x86-64-v3`) |

## 3. Build-Profile
- `Debug` (ASan/UBSan/TSan, Realtime-Validator-Debug-Hooks).
- `Release` (`-O3`, FTZ/DAZ, Validator statisch).
- `RelWithDebInfo` (Profiling, Symbol-erhalten).

## 4. Abhängigkeitsmanagement
- Vorgegebene Versionen (vcpkg/Conan oder vendored); Lockfile versioniert.
- Third-Party-Lizenzen in `THIRD_PARTY_NOTICES.md` (`LICENSE.md`).
- Kein unversionierter Download zur Build-Zeit im CI.

## 5. Toolchain-Versionen
- CMake 3.22+, NDK 26+ (für native-Android-Brücke, separater Build), Catch2 3.x / GoogleTest, Google-Benchmark.

## 6. Cross-Compile
- Linux→ARM (für Embedded-Targets) dokumentiert; native macOS ARM64 & x86_64 Universal.

## 7. ABI-Stabilität
- `vibecore_sdk.h` C-ABI; Symbol-Versionierung; `VK_SDK_API_VERSION` Major-Bruch ⇒ klare Migration (`21_Migration.md`).