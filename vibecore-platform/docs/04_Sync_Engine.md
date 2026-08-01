# 04 — Sync Engine

> Phase/Doc 04 · Status: Draft v1.0 · Owner: Senior Audio Programmer + Senior DSP Architect · Review: 15-Rollen, 2/3-Mehrheit

## 1. Rolle
Die Sync Engine ist die **einzige Zeitbasis** von VibeCoreLiv3. Sie liefert BPM, Beat, Bar, Tick, Song Position und Transport-State an alle Module. Kein Modul definiert eine eigene Uhr.

## 2. Zustandsgrößen
- `bpm` (float, 20.0–300.0), `beatsPerBar`, `beat`, `bar`, `tick` (24 ppqn), `phase01`, `songPos`.
- Transport: `playing`, `recording`, `loop?`, `position`.

## 3. Clock-Distribution
- Module rufen `getStateAt(audioTime)` (Pull-API) ab — kein Push-Timer im Audio-Pfad.
- Phase-Stabilität: Position berechnet aus `(audioTime - anchorTime) * (bpm/60) + offsetBeats`; Re-Anchor nur bei BPM-Wechsel/Quellenwechsel.
- Synchronisierte Module (Sequencer, Looper, Vocoder) lesen `nextDivisionAt(div, fromAudioTime)` für Quantisierung.

## 4. Externe Synchronisation
| Quelle | Modus | Richtung |
|---|---|---|
| MIDI-Clock | 24 ppqn | In |
| Ableton Link | Peer | Bi-Direktional |
| Audio-BPM-Sync | Onset→Tempo-Schätzung | In (vgl. VibeCore Sync) |
| DAW-Host (VST/AU/AAX) | Host-Clock | In |
- **Konfidenz-Gate:** externer Sync übernimmt erst nach gleitendem Fenster hoher Konfidenz.
- **PLL-Phase-Tracker:** re-anchor bei jedem konfidenten Beat (ohne Bar-Reset).

## 5. Audio-BPM-Sync (Referenz-Implementierung aus VibeCore)
Spektral-Flux-Onset-Detektor → Autokorrelation der Inter-Onset-Intervalle (60–200 BPM) → Konfidenz ≥ 0,5 ⇒ `setTempo` + `alignDownbeat`. Analyser **nicht** mit Destination verbunden (kein Audio-Bleed). Alle Zeiten in `AudioContext.currentTime`/Gerätezeit — kein `setTimeout`.

## 6. Jitter-Budget
- **< 0,1 ms @ 48 kHz** (P95) für interne Clock.
- Externer Sync: PLL-Gleitmittel reduziert Jitter auf Ziel; sonst Warnung + Grace.

## 7. Polyrhythmik / Polymetrik
- BeatsPerBar pro Pattern konfigurierbar; Polymetrik zwischen Szenen (nicht zwischen gleichzeitigen Parts derselben Szene — vgl. VibeCore Pattern-Domain).
- Sync liefert `phase01` pro Bar — Module quantisieren darauf.

## 8. Tests
- `tests/integration`: Multi-Modul-Clock-Lock (Sequencer + Looper + Vocoder bleiben im Takt).
- `tests/realtime`: Jitter-Histogramm über 60 s; P95 < 0,1 ms.
- Referenz: `tests/reference_audio/sync_tick_120bpm.wav`.