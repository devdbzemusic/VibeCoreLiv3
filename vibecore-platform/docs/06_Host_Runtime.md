# 06 — Host Runtime

> Phase/Doc 06 · Status: Draft v1.0 · Owner: Senior Audio Programmer + Senior Audio Hardware Architect · Review: 15-Rollen, 2/3-Mehrheit

## 1. Host
- Verwaltet Modul-Lebenszyklus (load → init → activate → process → deactivate → unload).
- Stellt Audio-Graph, Routing, I/O-Devices, Transport-State bereit.
- Safe-Mode kapselt Modul-Fehler (Bypass, Neustart), ohne Host-Absturz.

## 2. Module-Loader
- Manifest-gesteuert (`schemas/module.schema.json`): `api_version`, `dsp_version`, `module_version`, Pins, CPU-Schätzung, Signaturen.
- **Validierung vor Laden:** Signatur + Integrität (SHA-256) + Realtime-Validator (statische Heuristik).
- Inkompatible/unsichere Module werden kontrolliert abgelehnt (Fehler-Dialog, nicht Crash).

## 3. Audio-/MIDI-I/O
- Treiber-Strategie: **ASIO** (Windows), **CoreAudio** (macOS), **ALSA/PulseAudio/PipeWire** (Linux). Details `24_Hardware_Abstraction.md`.
- Puffergrößen: 64/128/256/512; Latenz-Hint (`low/interactive/playback`).
- **Device-Hot-Swap:** Geräteaustausch zur Laufzeit; Re-Konfiguration ohne Audio-Ausfall (kurze Grace-Mute).
- MIDI: In/Out, Clock (siehe `04_Sync_Engine.md`), SysEx-Whitelist.

## 4. Safe-Mode & Crash-Recovery
- Modul wirft/NaN ⇒ Knoten bypassed, Diagnostics loggt, Audio läuft weiter.
- Wiederholter Fehler ⇒ Modul deaktiviert; UI zeigt Recovery-Vorschlag.
- Host-Absturz ⇒ Project Runtime Recovery (`05_Project_Runtime.md`).

## 5. Diagnostics
- Live-Metriken: CPU/Modul, Memory, Jitter, Dropout-Count, Buffer-Underrun (siehe `15_Performance.md`).
- Inspector-Tool (`tools/`) zur Laufzeit-Überwachung; Profiling-API pro DSP-Block.

## 6. Tests
- `tests/integration`: Load/Unload-Zyklus, Hot-Swap, Safe-Mode-Bypass.
- `tests/realtime`: 60 s Dauerlast, Dropout-Count = 0 bei Budget-Last.
- `tests/regression`: Referenz-Set (Modul-Kombination) Peak/RMSvergleich.