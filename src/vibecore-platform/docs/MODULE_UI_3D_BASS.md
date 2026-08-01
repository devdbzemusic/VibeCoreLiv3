# MODULE UI — 3D Bass

**Instrumentenseite · Sub · Punch · Drive · Filter · Width · Glide**
**Status:** Production Ready

---

## Übersicht

Der 3D Bass Tab (BASS3D) ist die dedizierte Instrumentenseite für den 3D Bass-Synthesizer. Fokus auf die sechs Kernparameter für Bass-Sound-Design.

### Aufbau (UI Architect v2)
- **ModuleHeader** — Modulname · BPM · Transport · Pattern · Scene · Sync-Status (einheitlich für alle Module)
- **Voice Picker** — wählt den Part dem das 3D-Bass-Instrument zugewiesen wird (auto-setzt Engine auf 3D Bass)
- **CORE** — 6 Fokus-Parameter sofort sichtbar: SUB · PUNCH · DRIVE · FILTER · WIDTH · GLIDE
- **Deep Editor** — voller Workflow (SOUND → OSC → FILTER → DRIVE → DYN → ENV → 3D → FX → SAVE), erweiterte Parameter einklappbar

## Kernparameter (max 8, 6 primär)

| Parameter | Range | Beschreibung |
|-----------|-------|--------------|
| Sub | 0-100 | Sub-Oszillator Level |
| Punch | 0-100 | Transienten-Attack |
| Drive | 0-100 | Saturation/Verzerrung |
| Filter | 0-100 | Filter-Frequenz |
| Width | 0-100 | Stereo-Breite |
| Glide | 0-100 | Portamento/Glide-Time |
| Volume | 0-100 | Kanal-Lautstärke |
| Pan | -50..50 | Stereo-Position |

## UX Governance

- 1 Control = 1 Function
- Sofortiges Audition-Feedback
- Sub → Punch → Drive → Filter → Width → Glide (Workflow-Reihenfolge)
- Advanced-Layer für LFO/Modulation standardmäßig eingeklappt