# ROADMAP — VibeCoreLiv3

> Phasen-Übersicht mit Meilensteinen, Abhängigkeiten und Definition-of-Done (DoD). Phasen werden sequenziell freigegeben; eine Phase gilt erst mit erfülltem DoD als abgeschlossen.

## Abhängigkeitsmatrix

```
1 Platform Core ──┬─► 2 Sync Engine ──┬─► 3 Project Runtime ──► 4 Host Runtime ──► 5 SDK
                  │                  │
                  └──────────────────┴─► 6 Groove ─► 7 FX Mix ─► 8 Synth ─► 9 Sample Forge ─► 10 Remix
```
Querschnittlich einwirken: `03_DSP_Core`, `14_Testing`, `15_Performance`, `16_Security`, `17_Build_System`, `23_CI_CD`, `24_Hardware_Abstraction`.

## Phasen & DoD

| Phase | Meilenstein | DoD (messbar) |
|---|---|---|
| **1 — Platform Core** | DSP-Graph + Projektbasis | Audio-Thread-Regeln eingehalten; DSP-Block-Tests reproduzierbar (<1e-9); CI Unit-Tests grün; Projekt/Preset-Serialisierung ok; CPU-Budgets definiert + erste Messungen |
| **2 — Sync Engine** | Zentrale Zeitbasis | Alle Module beziehen Zeit aus Sync; externer Sync (MIDI-Clock) korrekt; **Jitter < 0,1 ms @ 48 kHz**; Multi-Modul-Integrationstests bestanden |
| **3 — Project Runtime** | Sessions/Scenes/Patterns | Transaktionen atomar; Autosave/Recovery verlustfrei; Versions-Historie korrekt; alle Daten = JSON-Schemas konform |
| **4 — Host Runtime** | Host + I/O | Module laden/init/entladen korrekt; Safe-Mode fängt Fehler ab; I/O (ASIO/CoreAudio/ALSA) erkannt + hot-swap; Diagnostics liefert CPU/Mem/Jitter |
| **5 — SDK** | Öffnung für Dritte | Externe Module bauen + laden; Thread-Safety-Matrix automatisch getestet; Validator prüft Realtime-Regeln; ≥2 Beispiel-Module funktionsfähig |
| **6 — Groove** | Performance-Core | Step/Piano-Roll sync-konsistent; Swing/Quantisierung ok; Live-Scene-Switch ohne Dropout; CPU im Budget |
| **7 — FX Mix** | Mixer + FX | Busses/Sends/Returns vollständig; Dynamics/Delay/Reverb/Mod realtime; Metering (Peak/RMS/Phase) korrekt; Inserts dynamisch |
| **8 — Synth & Bass** | Voice Core | Audio-Referenz-Vergleich bestanden; LFO/Env parametermoduliert; Preset-Laden stabil; Voice-CPU-Budget eingehalten |
| **9 — Sample Forge** | Recorder/Editor/Vocoder | Recording-Latenz < 5 ms; Stretch/Pitch artefaktarm; Vocoder/Looper sync-korrekt; Workflow durchgängig getestet |
| **10 — Remix** | Import/Stems/Clip/Export | Import (WAV/AIFF/MP3) ok; Stem-Trennung verfügbar; Clip-Engine nicht-destruktiv; Export verlustfrei |

## CI-Gate-Definition
„CI-grün" = Unit- + Integrations- + Realtime-Stresstests bestanden · CPU-Benchmark-Regression < 5 % · Kein neuer Jitter-Warn (P95 < 0,1 ms) · Validator ohne Realtime-Verstöße · Code-Coverage ≥ 70 % auf `src/core`.

## Innovations-Backlog (nicht in Phasen gebunden)
- KI-gestützte Groove-/Remix-Vorschläge (siehe `docs/12_AI.md`)
- Collaborative Sessions (Netzwerk-Sync über erweiterte Sync-Engine)
- Cloud-Asset-Library & Licensing-Server