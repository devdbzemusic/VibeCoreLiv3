# 20 — Glossary

> Phase/Doc 20 · Status: Draft v1.0 · Nachschlagewerk. Verbindliche Terminologie für alle Dokumente.

- **Audio-Thread** — Echtzeit-Thread, führt `process()` aus; kein Lock/Heap/I/O.
- **Bar / Beat / Tick** — Takt / Schlag / 24th-of-beat (PPQN); geliefert von Sync-Engine.
- **Block** — Verarbeitungsquantum (Default 256 Samples @ 48 kHz).
- **DSP-Core** — Deterministischer Signal-Graph; von Host/Project/SDK nicht direkt beeinflusst.
- **Denormal** — subnormale Float-Werte; FTZ/DAZ verhindert Performance-Einbruch.
- **Flam** — kurzer Doppel-Anschlag durch nicht grid-alignedes Switching; zu vermeiden.
- **Groove** — Timing-Identität (Swing/Humanize/Polyrhythmik); Performance-Core Phase 6.
- **Manifest** — signierte Modul-/Asset-Beschreibung (Versionen, Pins, Hash, Signatur).
- **ParamSnapshot** — atomare Kopie der Parameter, von Audio am Block-Anfang gelesen.
- **PatternPart** — „Pattern" in VibeCore-Domain; trägt Scenes[1..8].
- **PLL** — Phase-Locked-Loop; re-anchor externer Sync auf konfidenten Beat.
- **Polyrhythmik / Polymetrik** — verschiedene Taktarten je Part (Rhythmus) / je Szene (Metrum).
- **Realtime-Validator** — statische + Laufzeit-Prüfung verbotener Audio-Pfad-Konstrukte.
- **Safe-Mode** — Modul-Fehler → Bypass, kein Host-Crash.
- **SPSC** — Single-Producer/Single-Consumer-Ringbuffer (Audio↔UI).
- **Sync-Engine** — einzige Zeitbasis (BPM/Beat/Bar/Tick/SongPos).
- **Voice-Stealing** —Polyphonie-Verdrängungspolitik bei Voice-Mangel.
- **Scene-Switch** — grid-aligneder Übergang zwischen Szenen ohne Dropout.
- **Stem** — isolierter Audio-Kanal-Bundle (Remix, Phase 10).
- **DoD** — Definition of Done (messbare Kriterien pro Phase).
- **Baseline** — gemeinsam getaggte Release-Version aller Komponenten.