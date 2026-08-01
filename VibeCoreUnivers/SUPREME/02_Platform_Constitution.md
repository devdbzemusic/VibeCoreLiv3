# Band II — Platform Constitution

**VibeCore Univers · SUPREMÉ MASTERPROMPT**

---

## Fundamentprinzip

> Oboe ist kein nachträglicher Audio-Treiber.  
> Oboe ist das **Fundament** der nativen Audio-Plattform.

Es existiert genau **eine** Audio Engine.  
Alle Module — Groove, Synth, Bass, Voice, FX, AI — greifen auf dieselbe Engine zu.

---

## Native Audio Platform

### Schichtenarchitektur

```
React Native UI
        │
        ▼
TurboModules / JSI
        │
        ▼
VibeCore Native Platform
├── Oboe Audio Engine
├── DSP Core
├── Audio Graph
├── VibeCore Sync
├── Voice Manager
├── Sample Streaming
├── Bus Routing
├── Effect Routing
├── Scheduler
├── Performance Monitor
└── Metrics
```

### Build-Reihenfolge (strikt — kein Überspringen)

| Stufe | Modul | Anforderung |
|-------|-------|-------------|
| 1 | Oboe Core Engine | Fundament |
| 2 | VibeCore Sync | Unblocks alle Module |
| 3 | Groove | Erster Sound |
| 4 | Synth | Melodie |
| 5 | Bass | Bassline |
| 6 | FX Lab | Klangformung |
| 7 | Sample Forge | Sample-Workflow |
| 8 | Voice | Gesang |
| 9 | AI | Intelligenz |
| 10 | Brainwavez/Wave | Raum |
| 11 | Remix | Performance |

---

## Oboe Audio Engine

### Audio-Parameter

| Parameter | Wert |
|-----------|------|
| Sample Rate | 48 kHz |
| Buffer Size | 96 Frames |
| Latenz-Ziel | Low Latency |
| Priorität | AAudio bevorzugen |
| Fallback | OpenSL ES |
| Verarbeitung | Float 32 Bit |
| Kanäle | Stereo |
| Gesamt-Latenz | < 10 ms |

### Audio Thread — Realtime Safety (nicht verhandelbar)

Der Audio Callback darf **ausschließlich** enthalten:
- Mixing
- DSP
- Output

**Absolut verboten:**
- Speicherallokationen
- Logging
- Dateizugriffe
- UI-Operationen
- Mutex-Locks (nur Lock-free Strukturen)
- Systemaufrufe mit unbestimmter Latenz

### Akzeptanzkriterien Engine

| Kriterium | Anforderung |
|-----------|-------------|
| XRuns | keine |
| Glitches | keine |
| Heap-Allokationen im Callback | keine |
| Sample Rate | stabil 48 kHz |
| Gesamtlatenz | < 10 ms |

---

## DSP Core

### Grundlegende DSP-Operationen

| Funktion | Beschreibung |
|----------|-------------|
| Gain | Linearer Pegelsteller |
| Pan | Stereo-Panorama (Konstantleistungs-Kurve) |
| Limiter | Brick-Wall-Limiter |
| Soft Clip | Harmonisches Clipping |
| Peak Meter | True-Peak-Messung |
| RMS Meter | Energiemessung |
| DC Filter | DC-Offset-Entfernung |
| Master Bus | Summierer |
| Voice Routing | Mehrkanal-Voice-Management |
| Sample Mixing | Interpoliertes Sample-Mixing |

### DSP Node Architektur

Jeder Effekt ist ein eigenständiger **DSP Node**:
- Definierte Eingangs-/Ausgangsports
- Zustandslos oder mit isoliertem Zustand
- Thread-safe ohne globale Locks
- Deterministisches Laufzeitverhalten

---

## Audio Graph

### Signalfluss (kanonisch)

```
Track Input
    ↓
Insert FX Chain
    ↓
Channel Strip (Gain · Pan · Width)
    ↓
Bus Routing (Send/Return)
    ↓
Send FX Chain
    ↓
REMIX Engine
    ↓
3D Matrix / Psychoacoustic Spatial
    ↓
Master Bus
    ↓
Limiter
    ↓
Audio Output (Oboe)
```

### Routing-Typen

| Typ | Beschreibung |
|-----|-------------|
| Insert | Seriell im Signalweg |
| Send | Parallelpfad mit Return |
| Bus | Gruppen-Summierer |
| Sidechain | Externer Steuerpfad |

---

## Memory Management

### Strategie

- Alle Audio-Puffer werden **beim Start** prä-allokiert
- Zero Heap-Allokationen im Audio-Thread
- Lock-free Ring-Buffer für Audio↔UI-Kommunikation
- RAII für alle Ressourcen außerhalb des Audio-Threads
- Memory Pool für Voice-Objekte (maximale Voice-Anzahl bekannt)

### Puffer-Dimensionierung

| Puffer | Größe |
|--------|-------|
| Audio Output Buffer | 96 Frames × 2 Kanäle × 4 Bytes |
| Voice Pool | 64 Voices prä-allokiert |
| Sample Slots | 64 Slots prä-allokiert |
| Ring Buffer (UI→Audio) | 4096 Einträge lock-free |

---

## Threading

### Thread-Hierarchie

| Thread | Priorität | Aufgaben |
|--------|-----------|---------|
| Audio Callback | SCHED_FIFO max | Mix · DSP · Output |
| Scheduler Thread | SCHED_FIFO high | Note Events · Automation |
| File I/O Thread | Normal | Sample Loading · Streaming |
| UI Thread | Normal | Render · User Input |
| AI Thread | Low | Genre-Analyse · Vorschläge |

### Thread-Kommunikation

Ausschließlich über **Lock-free Strukturen**:
- `std::atomic<>` für einzelne Werte
- Lock-free Ring-Buffer für Event-Streams
- Double-Buffer für komplexe Zustände (UI liest, Audio schreibt)

---

## Audio Graph Scheduler

### Anforderungen

- PPQ-Auflösung: **1920**
- Sample-genaue Event-Ausführung
- Look-Ahead: ≥ 1 Buffer-Länge (96 Frames)
- Swing/Shuffle/Humanize als Post-Quantisierungs-Schicht
- Externe Sync-Quellen: MIDI Clock · Ableton Link

### Clock-Invariante

Es existiert genau **eine** Master Clock: **VibeCore Sync**.  
Kein Modul implementiert eine eigene Clock oder einen eigenen Timer.

---

## VibeCore Sync

### Transport-Modell

| Konzept | Beschreibung |
|---------|-------------|
| BPM | Einzige Tempo-Autorität |
| Beat / Bar / Tick | Abgeleitet von BPM und PPQ |
| Song Position | Globale, monoton steigende Position |
| Pattern Clock | Lokale Schleife auf Song-Basis |
| Loop Engine | Start/End-Point mit nahtlosem Wrap |

### Akzeptanzkriterien Sync

| Kriterium | Anforderung |
|-----------|-------------|
| Jitter | < 0,5 ms |
| Tempo-Stabilität | keine Drift |
| Scheduling | Sample-accurate |
| Externe Sync | MIDI Clock + Ableton Link |

---

## Plugin-System

### Anforderungen (v1.0)

- Jeder DSP-Node ist ein potentielles Plugin-Interface
- Plugin-API wird durch Band VII (Future Constitution) spezifiziert
- Interne Module nutzen dieselbe API wie zukünftige externe Plugins
- **No Internal/External Split** — interner Code ist der Beweis, dass die API funktioniert

---

## Teststrategie

### Ebenen

| Ebene | Was getestet wird |
|-------|------------------|
| Unit | Jede DSP-Funktion isoliert |
| Integration | Modul gegen Audio-Graph |
| Performance | XRun-Rate · Latenz · CPU unter Last |
| Regression | Kein Test-Bestand wird gelöscht |
| Realtime Safety | Automatisierter Thread-Sanitizer |

### Realtime Safety Enforcement

- ThreadSanitizer in CI für alle Audio-Thread-Pfade
- Custom Allocator-Hook: Allokation im Audio-Thread → Test schlägt fehl
- Latenz-Messung in jedem CI-Durchlauf

---

*Band II — Platform Constitution · VibeCore Univers SUPREMÉ MASTERPROMPT*
