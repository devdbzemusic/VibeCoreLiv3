# MODULE UI — 3D Synth

**Instrumentenseite · Max 8 Parameter · Keine Parameterflut**
**Status:** Production Ready

---

## Übersicht

Der 3D Synth Tab (SYNTH3D) ist die dedizierte Instrumentenseite für den 3D Synthesizer. Er folgt streng der Acht-Regler-Regel — niemals mehr als 8 Hauptparameter gleichzeitig sichtbar.

### Aufbau (UI Architect v2)
- **ModuleHeader** — Modulname · BPM · Transport · Pattern · Scene · Sync-Status (einheitlich für alle Module)
- **Voice Picker** — wählt den Part dem das 3D-Synth-Instrument zugewiesen wird (auto-setzt Engine auf 3D)
- **CORE** — 8 Primärparameter sofort sichtbar: OSC LVL · FILTER · RESO Q · SUB · ATTACK · RELEASE · WIDTH · UNISON
- **Deep Editor** — voller Workflow (SOUND → OSC → FILTER → ENV → 3D → FX → SAVE), erweiterte Parameter einklappbar

## 3D Synth Parameter (max 8 sichtbar)

| Parameter | Range | Beschreibung |
|-----------|-------|--------------|
| Waveform | sine/square/saw/tri | Oszillator-Typ |
| Cutoff | 0-100 | Filter-Frequenz |
| Resonance | 0-100 | Filter-Resonanz |
| Attack | 0-100 | Hüllkurve Attack |
| Release | 0-100 | Hüllkurve Release |
| Spatial X | -100..100 | 3D Position X |
| Spatial Y | -100..100 | 3D Position Y |
| Spatial Z | -100..100 | 3D Position Z |

### Erweiterte Parameter (einklappbar)
- LFO Rate, LFO Depth
- Modulation Routing
- Drive, Saturation

## UX Governance

- 1 Control = 1 Function
- Sofortiges Audition-Feedback bei Parameteränderung
- Advanced-Layer standardmäßig eingeklappt
- Sound Select → Oscillators → Filter → Env → Spatial → FX → Save