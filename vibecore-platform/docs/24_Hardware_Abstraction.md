# 24 — Hardware Abstraction

> Phase/Doc 24 · Status: Draft v1.0 · Owner: Senior Audio Hardware Architect · Review: 15-Rollen, 2/3-Mehrheit

## 1. Treiber-Strategie
| Plattform | Primär | Sekundär |
|---|---|---|
| Windows | ASIO (low-latency) | WASAPI (shared/exclusive), WDM |
| macOS | CoreAudio | — |
| Linux | ALSA | PipeWire, PulseAudio, JACK |

## 2. Latenz-Management
- Puffergrößen 64/128/256/512; Latency-Hint (`low/interactive/playback`).
- Input/Output-Latenz gemeldet an UI & Diagnostics (`15_Performance.md`).
- Gesamt-Latenz-Budget dokumentiert; Ziel: round-trip < 10 ms (Treiber-abhängig).

## 3. Device-Hot-Swap
- Geräteaustausch zur Laufzeit; Re-Konfiguration ohne Audio-Ausfall (kurze Grace-Mute, keine Pause der Sync-Engine).
- Sync-Engine läuft weiter; I/O re-verbindet (kein Re-Anchor nötig bei gleicher SR).

## 4. Sample-Rate / Block-Wechsel
- SR-Wechsel ⇒ kontrollierter Re-Init aller Module (deactivate → activate); Pools vorallokiert neu.
- Block-Wechsel zur Laufzeit unterstützt (Module lesen `numFrames` pro Block).

## 5. MIDI
- In/Out; Clock (`04_Sync_Engine.md`); SysEx-Whitelist (Sicherheit `16_Security.md`).

## 6. Native Android (separat)
- Oboe (C++/AAudio) Low-Latency via JNI-Bridge; separater Build im `native-android/`-Modul der Web-App. Hier nur Referenz-Dokumentation; Integration via SDK-Modul möglich.

## 7. Tests
- `tests/integration`: Hot-Swap, SR-Wechsel, Block-Wechsel ohne Dropout.
- `tests/regression`: Latenz-Messung pro Treiber (Dokumentation in `15_Performance.md`).