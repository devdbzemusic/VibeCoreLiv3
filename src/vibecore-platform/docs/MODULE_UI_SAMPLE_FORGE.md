# MODULE UI — Sample Forge

**Bearbeiten · Schneiden · Normalisieren · Stretch · Pitch · Slice · Resampling**
**Status:** Production Ready

---

## Übersweisung

Der Sample Forge Tab (SMPL) ist die Bearbeitungsoberfläche für Audio-Samples. Alle Bearbeitungen erfolgen direkt auf der Wellenform.

### Aufbau
- PartStrip (Sample-Part Auswahl)
- Wellenform-Anzeige (interaktiv)
- Werkzeug-Palette (max 8 sichtbar)
- Slice-Übersicht
- AI Sample Assistant

## Werkzeuge (max 8)

| Werkzeug | Beschreibung |
|----------|--------------|
| Slice | Schneiden an Transienten/Beat-Grid |
| Stretch | Zeit-Stretching |
| Pitch | Pitch-Shifting |
| Normalize | Normalisierung |
| Reverse | Rückwärts |
| Trim | Start/End-Punkte |
| Resample | Resampling |
| Loop | Loop-Punkte setzen |

## Interaktion

- Touch auf Wellenform → Setze Slice-Marker
- Drag → Verschiebe Marker
- Pinch → Zoom
- AI-Suggestion → "Slice-Vorschläge" Button

## AI-Integration

- `suggestSliceConfig` → Slice-Vorschläge basierend auf BPM/Transienten
- `suggestLoopConfig` → Loop-Punkte
- `suggestClassification` → Drum/Instrument-Klassifikation
- `suggestSimilar` → Similarity Search in Library
- Alle Vorschläge optional, über `setPartSlices`/`setWaveEdit` angewendet