# MODULE UI — Groove

**Zentrale Produktionsoberfläche · Pattern · Piano Roll · Pattern Chain**
**Status:** Production Ready

---

## Übersicht

Groove ist das Herzstück von VibeCoreLiv3. Es besteht aus zwei Editieransichten:

1. **SEQ** — Step Sequencer (rhythmische Pattern-Programmierung)
2. **ROLL** — Piano Roll (melodische/harmonische Noten-Programmierung)

Beide nutzen dieselbe Scene/Step-Struktur aus dem Store.

## SEQ — Step Sequencer

### Aufbau
- PartStrip (Part-Auswahl)
- Pattern/Scene Header (Name, Scene-Chain, Länge, Swing)
- Edit-Mode Selector (7 Modi: TRIG, VEL, PROB, GATE, RAT, μ, ACC)
- Step Grid (16 Steps, farbcodiert nach Part)
- Channel Strip (Volume, Pan, Mute, Solo)
- Step Detail Editor (Velocity, Probability, Gate, Micro, Pitch, Humanize, Ratchet, Accent, Condition)

### Touch-Interaktion
- Tap Step → Toggle (TRIG-Mode) oder Parameter-Edit
- Step ist `touch-none` + `pointer-capture` für präzises Tap
- Step-Zellen sind min. 44px (aspect-square)

## ROLL — Piano Roll

Die Piano Roll ist die einzige melodische Editieroberfläche. Bearbeitet Drums, Synth, Bass, Samples und Automation über ein einheitliches Note-Grid.

## Pattern Chain (Song Mode)

- Chain Steps mit Repeat-Counts, Skip-Flags, Markers
- Chain Mode: IMMEDIATE (sofort) oder BOUNDARY (an Taktgrenze)
- Live Pattern Switch via Queue

## Parameter-Limits

| Bereich | Sichtbare Parameter |
|---------|---------------------|
| Step Detail | 7 Slider + Accent Toggle + Condition |
| Scene | Länge, Swing |
| Channel | Volume, Pan, Mute, Solo |

## AI-Integration

- Groove AI: kontextbezogene Vorschläge (Co-Assistant Tab)
- Apply via `setPatternSteps` (immutable → rückgängig)