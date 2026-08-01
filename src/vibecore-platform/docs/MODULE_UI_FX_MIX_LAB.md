# MODULE UI — FX Mix Lab

**Effekte als Produktionswerkzeuge · Live editierbar · Keine Plugin-Liste**
**Status:** Production Ready

---

## Übersicht

Der FX Mix Lab besteht aus zwei Tabs: MIX (Mixer) und FX (Effekte). Effekte werden als Produktionswerkzeuge dargestellt, nicht als Plugin-Liste.

## MIX — Mixer

### Aufbau
- 16 Stereo Part-Fader (horizontal scrollbar)
- Pro Fader: Volume, Pan, Pitch, Mute, Solo, Peak-Meter
- Master Section
- Touch-optimierte Fader (min. 44px height)

## FX — Effekte

### Aufbau
- 6 FX Slots (A-F)
- Pro Slot: Type, Mix, Boost, Bypass
- Parameter-Panel für ausgewählten Slot (max 8 sichtbar)
- FX Routing (hybrid/serial/parallel)
- Shared Floor Toggle

### FX Types
EQ, Compressor, Limiter, Gate, Distortion, Saturation, Tube, Tape, Chorus, Flanger, Phaser, Delay, Reverb, Filter, Stereo Width, etc.

## AI-Integration

- Mix AI: Gain Staging, EQ-Vorschläge, Clipping-Warnungen
- Automation AI: Filter-Sweeps, Buildups, Breakdowns, Drops
- Alle Vorschläge als Empfehlungen, keine automatischen Änderungen
- Angewendet über `setPartVolume`/`setSend`/`setFxParam`

## Live-Performance

- Parameteränderungen greifen in Echtzeit
- Automation sample-accurate via songTicks
- Keine Audio-Unterbrechung bei FX-Wechsel