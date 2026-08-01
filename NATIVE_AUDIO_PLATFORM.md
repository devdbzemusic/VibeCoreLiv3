# VibeCore Native Audio Platform — Architektur-MASTERPROMPTs

**Version:** 1.0  
**Status:** Verbindlich für die gesamte native Audio-Plattform  
**Schichtordnung:** Oboe → Sync → Groove → Synth → Bass → FX Lab → Sample Forge → Voice → AI → Brainwavez → Remix

---

## Fundamentprinzip

Oboe ist **kein nachträglicher Audio-Treiber**.  
Oboe ist das **Fundament der nativen Audio-Plattform**.

Alle Module (Groove, Synth, Bass, Voice, AI, FX) greifen auf **dieselbe** Engine zu.  
Es existiert genau **eine** Audio Engine.

```
React Native UI
        │
        ▼
TurboModules / JSI
        │
        ▼
VibeCore Native Platform
├── Oboe Audio Engine          ← MASTERPROMPT 1
├── DSP Core
├── VibeCore Sync              ← MASTERPROMPT 2
├── Groove                     ← MASTERPROMPT 3
├── Synth                      ← MASTERPROMPT 4
├── Bass                       ← MASTERPROMPT 5
├── FX Lab                     ← MASTERPROMPT 6
├── Sample Forge               ← MASTERPROMPT 7
├── Voice                      ← MASTERPROMPT 8
├── Brainwavez                 ← MASTERPROMPT 9
└── AI Services                ← MASTERPROMPT 10
```

---

## MASTERPROMPT 1 — VibeCore Native Engine (Oboe Core)

### Mission

Du bist das Engineering Board aus 15 Principal Engineers.

Entwickle eine professionelle **Android Native Audio Engine** auf Basis von Oboe.

Diese Engine bildet das **Fundament** von VibeCoreLiv3.

Sie darf **keinerlei UI** enthalten.

Sie ist ausschließlich zuständig für:
- Audio
- Timing
- DSP
- Streaming
- Synchronisation

### Ziel

Baue eine Engine auf **DAW-Niveau**.

- Keine Demo
- Keine Beispiele
- Keine Vereinfachungen

### Architektur

```
VibeCore Native Engine
│
├── Oboe Audio Engine
├── Audio Callback
├── DSP Engine
├── Mixer
├── Bus Routing
├── Effect Routing
├── Sample Streaming
├── Voice Manager
├── Scheduler
├── Performance Monitor
└── Metrics
```

### Audio Thread

Der Audio Callback darf **ausschließlich** enthalten:
- Mixing
- DSP
- Output

**Verboten:**
- Speicherallokationen
- Logging
- Dateizugriffe
- UI
- Locks

### Audio Parameter

| Parameter | Wert |
|-----------|------|
| Sample Rate | 48 kHz |
| Buffer Size | 96 Frames |
| Latenz | Low Latency |
| Priorität | AAudio bevorzugen |
| Fallback | OpenSL ES |
| Verarbeitung | Float 32 Bit |
| Kanäle | Stereo |

### DSP

Implementiere:
- Gain
- Pan
- Limiter
- Soft Clip
- Peak Meter
- RMS Meter
- DC Filter
- Master Bus
- Voice Routing
- Sample Mixing

### Performance

Implementiere:
- CPU Meter
- XRun Counter
- Realtime CPU
- DSP Load
- Latency
- Voice Count
- Buffer Health
- Realtime Safety

### Abnahmekriterien

Die Audio Engine gilt erst als fertig wenn:

| Kriterium | Anforderung |
|-----------|-------------|
| XRuns | keine |
| Glitches | keine |
| Speicherallokationen im Callback | keine |
| Sample Rate | stabil 48 kHz |
| Gesamtlatenz | < 10 ms |

---

## MASTERPROMPT 2 — VibeCore Sync (Oboe Integration)

### Mission

Baue VibeCore Sync **direkt auf der nativen Oboe Engine** auf.

Sync ist die **einzige** Master Clock.  
Alle Module beziehen ihr Timing **ausschließlich** von VibeCore Sync.

### Implementiere

| Bereich | Komponenten |
|---------|-------------|
| Transport | Tempo · Beat · Bar · Tick |
| Timing | PPQ 1920 · Pattern Clock · Song Position |
| Loop | Loop Engine |
| Extern | External MIDI Clock |
| Intern | Internal Clock · Clock Drift Correction |
| Ausdruck | Swing · Shuffle · Humanize |
| Scheduling | Look Ahead Scheduler · Sample Accurate Scheduling |

> Der Oboe Callback darf **niemals** Timing verlieren.

### Abnahmekriterien

| Kriterium | Anforderung |
|-----------|-------------|
| Jitter | < 0,5 ms |
| Tempo | stabil |
| Drift | keine |
| Scheduling | Sample Accurate |

---

## MASTERPROMPT 3 — VibeCore Groove

### Mission

Verbinde Groove **vollständig** mit Oboe.

- Keine eigene Engine
- Keine eigenen Timer
- Alles kommt von Sync

### Implementiere

- 15 Drum Tracks
- Sample Playback
- Voice Allocation
- Polyphony
- Mute / Solo
- Piano Roll Step Sequencer
- Accent
- Velocity
- Probability
- Micro Timing
- Automation
- Round Robin
- Choke Groups
- Realtime FX Send
- Pattern Chain

### Workflow

| Regel | Anforderung |
|-------|-------------|
| One Touch | Maximal eine Geste |
| 5-Sekunden-Regel | Maximal 5 Sekunden bis Sound |
| Navigation | Keine Menüs |
| Haptik | Hardware Feeling |

---

## MASTERPROMPT 4 — VibeCore Synth

Nutze **dieselbe** Oboe Engine.

### Implementiere

- Voice Manager
- 4-fach Paraphonie
- Oscillator
- Noise
- Filter
- ADSR
- LFO
- Mod Matrix
- Stereo Engine
- Oversampling
- Voice Stealing
- Unison
- Detune
- Preset System

### Workflow

> Ein Regler = Eine Funktion.  
> Keine versteckten Menüs.

---

## MASTERPROMPT 5 — VibeCore Bass

Optimiert für **Techno**.

### Implementiere

- Mono Bass
- Mono Legato
- Slide
- Accent
- Drive
- Filter
- Envelope
- Sub Layer
- Stereo Width
- Groove Quantize

---

## MASTERPROMPT 6 — VibeCore FX Lab

Nutze **ausschließlich** Bus Routing.

### Implementiere

| Bereich | Effekte |
|---------|---------|
| Dynamics | EQ · Compressor · Limiter |
| Distortion | Distortion · Bitcrusher |
| Time | Reverb · Delay |
| Modulation | Flanger · Phaser · Chorus |
| Grain | Grain · Freeze |
| Pitch | Pitch |
| Spatial | Stereo Widener · Psychoakustische Spatial Matrix · Binaural Processor |

> Jeder Effekt läuft als **DSP Node**.

> Die Psychoakustische Spatial Matrix ist ein kreatives Klangdesign-Werkzeug.  
> Sie erzeugt immersive Klangräume durch binaurale Signalverarbeitung, ITD, ILD, HRTF, M/S und Phasenmanipulation.  
> Sie macht **keine medizinischen oder therapeutischen Wirkungsversprechen**.

---

## MASTERPROMPT 7 — VibeCore Sample Forge

> Keine Ladepausen.

### Implementiere

- Streaming
- Recording
- Trim
- Normalize
- Fade
- Reverse
- Stretch
- Pitch
- Slice
- Auto Slice
- Transient Detection
- Loop Detection
- Sample Analyse
- Caching

---

## MASTERPROMPT 8 — VibeCore Voice

Alles läuft über **dieselbe** Oboe Engine.

### Implementiere

- Recording
- Noise Reduction
- Pitch Analyse
- Formant
- Harmony
- Realtime FX
- Granular Voice
- Looper
- Auto Gain

---

## MASTERPROMPT 9 — VibeCore Brainwavez

Direkt auf **DSP**. Nicht als Plugin.

### Implementiere

- Binaural Generator
- Isochronic Generator
- Monaural Beats
- Carrier Engine
- Brainwave Presets
- Realtime Automation
- Safety Limits

> Binaural- und isochronische Verarbeitung sind **technische Audiofunktionen**.  
> Mögliche psychologische oder neurologische Wirkungen beim Hörer bleiben ein offener Forschungs- und Kreativbereich.  
> Sie werden nicht als garantiertes Ergebnis kommuniziert oder vermarktet.

---

## MASTERPROMPT 10 — VibeCore AI

### Mission

Die KI steuert **keine** Audioverarbeitung.  
Sie analysiert den musikalischen Kontext und erzeugt **Vorschläge**.  
Die eigentliche Audioberechnung verbleibt vollständig in der nativen Oboe-/DSP-Engine.

### Implementiere

| Bereich | Funktion |
|---------|----------|
| Analyse | Groove-Analyse · Harmonie-Analyse |
| Vorschläge | Pattern · Melodie · Bassline · Arrangement |
| Unterstützung | Mix-Assist · Performance-Assist · Workflow-Assist |

> Die KI muss den One-Touch-Workflow unterstützen.  
> Vorschläge müssen in wenigen Interaktionen verfügbar sein.  
> Der kreative Fluss darf niemals unterbrochen werden.

---

## Implementierungsreihenfolge

```
1. Oboe Core Engine          → Fundament
2. VibeCore Sync             → Master Clock
3. Groove                    → Erster Sound
4. Synth                     → Melodie
5. Bass                      → Bassline
6. FX Lab                    → Klangformung
7. Sample Forge              → Sample-Workflow
8. Voice                     → Gesang
9. AI                        → Intelligenz
10. Brainwavez               → Raum
11. Remix                    → Performance
```

Kein Modul wird integriert, bevor sein Fundament stabil ist.

---

## Bestehende Basis (native-android/)

Die aktuelle Engine (`vibecore_engine.h/.cpp`) implementiert bereits:
- Oboe AAudio-Stream mit OpenSL ES Fallback
- 48 kHz · 96 Frames per Burst
- Float32 Stereo
- 64-Voice Sample-Mixer
- ADPF Performance Hints (Android 12+)
- Big-Core CPU Affinity (SynthMark-basiert)

Dies ist der **Ausgangspunkt für MASTERPROMPT 1**.  
Fehlende Schichten: DSP Core · Bus Routing · Sync · alle Module.

---

*Version 1.0 — Verbindlich für alle nativen Implementierungsentscheidungen.*  
*Schichtordnung: Oboe → Sync → Groove → Synth → Bass → FX → Forge → Voice → AI → Brainwavez → Remix*
