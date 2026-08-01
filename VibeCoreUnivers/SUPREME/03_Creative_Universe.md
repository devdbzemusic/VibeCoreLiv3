# Band III — Creative Universe

**VibeCore Univers · SUPREMÉ MASTERPROMPT**

---

## Modulübersicht

```
VibeCore Creative Universe
│
├── GROOVE          Piano Roll · Patterns · Scenes · ARP
├── 3D SYNTH        Spectral · FM · Wavetable · Mod Matrix
├── 3D BASS         Mono · Drive · Sub · Techno-optimiert
├── VOICE           Vocoder · Harmoniser · Granular · Looper
├── SAMPLE FORGE    Slice · Granular · Transient · Streaming
├── FX MIX LAB      Mix · FX · Perform · Remix · 3D Matrix
├── WAVE            Binaural · Psychoacoustic Spatial
└── AI              Performance Director · Genre Intelligence
```

---

## GROOVE

Das Herzstück der Rhythmusproduktion.

### Universal Piano Roll

Ein einziger, kontextabhängiger Editor ersetzt alle Step-Sequencer.

**Drum-Modus:**
Trigger · Velocity · Probability · Ratchet · Flam · Roll · Micro Timing · Step FX

**Instrument-Modus:**
Tonhöhe · Notenlänge · Velocity · Glide · Automation · Chords

### Groove-Engine

| Feature | Beschreibung |
|---------|-------------|
| Tracks | 15 Drum Tracks |
| Polyphonie | Vollpolyphon |
| Mute/Solo | Pro Track |
| Choke Groups | Sample-Chaining |
| Round Robin | Velocity-basiert |
| Probability | 0–100% pro Step |
| Micro Timing | ± 50% Schritt-Offset |

### Pattern-System

| Konzept | Beschreibung |
|---------|-------------|
| Scenes | 1–8 Szenen pro Pattern |
| Scene Length | 4/8/16/32/64 Schritte |
| Polymetrie | Zwischen aufeinanderfolgenden Szenen |
| Pattern Chain | Sequenzielle oder Live-Verkettung |
| Scene Morph | Nahtloser Übergang ohne Artefakte |

### ARP (AI Arpeggiator — vollständig integriert)

→ Siehe Band IV — AI Constitution für die vollständige Spezifikation.

**ARP ist kein eigenständiges Modul.**  
Er ist Sub-Tab 4 von GROOVE und nutzt die globale ARP-Engine.

---

## 3D SYNTH

Spektraler, multidimensionaler Synthesizer.

### Architektur

| Schicht | Beschreibung |
|---------|-------------|
| Oscillator | Wavetable · FM · Spectral · Noise |
| Filter | Multi-Mode (LP/HP/BP/Notch) |
| ADSR | Hüllkurve für Amplitude + Filter |
| LFO | Modulationsquelle für beliebige Ziele |
| Mod Matrix | N×M freie Modulations-Verbindungen |
| Unison | Bis 8 Stimmen · Detune · Stereo-Spread |

### Voice Management

- 4-fach Paraphonie
- Voice Stealing (konfigurierbar: Oldest/Lowest/Quietest)
- Oversampling (2× / 4×)
- Preset System (versionierbar, exportierbar)

### Workflow

> Ein Regler = Eine Funktion.  
> Keine versteckten Menüs.

---

## 3D BASS

Optimiert für **Techno, Acid, Psytrance, Hardtechno**.

### Features

| Feature | Beschreibung |
|---------|-------------|
| Mono Bass | Strikt monophon |
| Mono Legato | Portamento bei Legato-Spiel |
| Slide | Zeit-basiertes Pitch-Glide |
| Accent | Velocity-abhängige Pegelspitze |
| Drive | Harmonische Sättigung |
| Filter | Resonanter Multi-Mode Filter |
| Envelope | Attack/Decay/Sustain/Release |
| Sub Layer | Parallele Tiefbass-Schicht |
| Stereo Width | M/S-basierte Breitensteuerung |
| Groove Quantize | Timing-Anbindung an GROOVE |

---

## VOICE

Live-Gesangs- und Sprachverarbeitungsmodul.

### Features

| Feature | Beschreibung |
|---------|-------------|
| Recording | Echtzeit-Aufnahme über Mikrofon |
| Noise Reduction | Adaptiver Rauschunterdrücker |
| Pitch Analyse | Melodieerkennung |
| Formant | Formant-Shift unabhängig von Pitch |
| Harmony | Mehrstimmige Echtzeit-Harmonisierung |
| Realtime FX | Insert-FX direkt auf Gesangssignal |
| Granular Voice | Granular-Synthese auf Voicematerial |
| Looper | Sample-genauer Echtzeit-Looper |
| Auto Gain | Pegelnormalisierung |

**Alle Funktionen laufen über die zentrale Oboe-Engine.**

---

## SAMPLE FORGE

Professioneller Sample-Editor ohne Ladepausen.

### Features

| Bereich | Funktion |
|---------|----------|
| Transport | Streaming · Caching · Puffer-Management |
| Recording | Echtzeit-Sample-Aufnahme |
| Editing | Trim · Normalize · Fade · Reverse |
| Transformation | Stretch · Pitch Shift |
| Slice | Manuelle Slice-Marker · Auto Slice |
| Analyse | Transient Detection · Loop Detection · Sample Analyse |
| Integration | Direktverbindung zu GROOVE-Tracks |

### Performance-Anforderung

> Kein sichtbares Laden.  
> Samples werden im Hintergrund gestreamt und gecacht.  
> Slice-Marker persistieren zwischen Sessions.

---

## FX MIX LAB SUPREMÉ

Das **zentrale Herzstück** jeder Live-Performance.  
Kein Mixer. Kein Effektmodul. Ein **performatives Instrument**.

### Sub-Tab-Struktur

| Tab | TabKey | Inhalt |
|-----|--------|--------|
| MIX | `MIX` | Kanalzüge · Routing · Meter · Limiter · Analyzer |
| FX | `FX` | DSP Nodes · Insert/Send/Parallel |
| PERFORM | `PERF` | XY Pad · Macros · Morph · Crossfader · Ribbon |
| REMIX | `REMIX` | Beat Repeat · Stutter · Glitch · Looper · Resampling |
| 3D MTX | `PROD` | Psychoacoustic Spatial Matrix |

### MIX

Kanalzüge · Lautstärke · Pan · Stereo Width · Mute · Solo  
Bus Routing · Gruppen · Master · Peak/RMS Meter · Limiter · Clip Detection · Analyzer

### FX — DSP Node Bibliothek

| Kategorie | Effekte |
|-----------|---------|
| Dynamics | EQ · Compressor · Limiter · Gate |
| Saturation | Saturation · Distortion · Bitcrusher |
| Modulation | Chorus · Flanger · Phaser |
| Time | Delay · BPM Delay · Reverb · Freeze |
| Pitch | Pitch Shift · Grain |
| Filter | Filter · Resonator |
| Spatial | Stereo Widener · Binaural Processor |

### PERFORM

XY Pad · Dual XY Pad · Macro Controls (modulübergreifend)  
Morph Engine · Motion Recording · Live Automation · Crossfader  
Scene Recall · Macro Snapshots · Parameter Locks · Ribbon Controller  
Touch Gestures · Randomizer · Humanizer

### REMIX (vollständig integriert — kein eigenes Modul)

Beat Repeat · Roll · Reverse · Tape Stop · Stutter · Glitch  
Live Looper · Slice Trigger · Beat Jump · Buffer Freeze  
Reverse Buffer · Random Slice · Live Resampling

### 3D MATRIX — Psychoacoustic Spatial

> Kreatives Klangdesign-Werkzeug. Keine medizinischen oder therapeutischen Wirkungsversprechen.

| Dimension | Beschreibung |
|-----------|-------------|
| Left ↔ Right | Panorama |
| Front ↔ Back | Tiefe |
| Height | Höhenwahrnehmung |
| Width | Stereobreite |
| Depth | Raumtiefe |
| Focus | Fokussierung |
| Motion | Bewegungsdynamik |
| Diffusion | Diffusität |
| Air | Hochfrequenz-Raum |
| Presence | Präsenz/Vordergründigkeit |

---

## WAVE (Binaural + Psychoacoustic Spatial)

Kreatives Klangdesign-System für immersive Klangräume.

### Binaural Engine

| Feature | Beschreibung |
|---------|-------------|
| Binaurale Frequenzdifferenz | Frei definierbar |
| Automation | Differenzfrequenz automatable |
| Sync | Unabhängig vom Songtempo |
| Carrier | Kombinierbar mit Reverb/Delay/Modulation |
| Safety Limits | Automatische Pegelgrenzen |
| Presets | Versionierbar, exportierbar |

### Psychoacoustic Spatial Matrix

Binaurale Signalverarbeitung · ITD · ILD · HRTF (optional)  
Mid/Side-Verarbeitung · Stereo-Breitenkontrolle  
Phasenmanipulation (innerhalb sicherer Grenzen)  
Spektrale Verteilung · Modulierte Stereofeld-Bewegungen  
Psychoakustische Maskierung als Sound-Design-Werkzeug

> Mögliche psychologische oder neurologische Wirkungen beim Hörer bleiben ein offener Forschungs- und Kreativbereich.  
> Sie werden nicht als garantiertes Ergebnis kommuniziert.

---

## Modul-Interconnect

Alle Module kommunizieren über definierte APIs.  
Keine direkte Kopplung zwischen Modulen.  
Gemeinsame Ressourcen ausschließlich über:

- VibeCore Sync (Timing)
- Oboe/DSP Core (Audio)
- Audio Graph (Routing)
- Macro Engine (Parameter-Steuerung)
- Automation Engine (Zeitbasierte Steuerung)

---

*Band III — Creative Universe · VibeCore Univers SUPREMÉ MASTERPROMPT*
