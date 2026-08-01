# MODULE UI — Voice

**Sprachaufnahme · Vocal-Produktion · Pitch · Formant · Stretch · Slice**
**Status:** Production Ready

---

## Übersicht

Der Voice Tab ist optimiert für Sprachaufnahme und Vocal-Produktion. Er bietet direkte Aufnahme, Take-Verwaltung und AI-gestützte Vocal-Bearbeitung.

### Aufbau
1. PartStrip (Part-Auswahl)
2. Record Bar (großer Record-Button, Take-Count, Status)
3. 8 Vocal Parameter (Pitch, Volume, Pan, Formant, Stretch, Drive, Reverb, Delay)
4. AI Vocal Assistant (4 Tools: Pitch, Harmony, Layer, Phrase)
5. Take List (Noten im aktuellen Scene)

## Record Bar

- Großer Record-Button (56px, rot, touch-optimiert)
- Status: RECORDING / MONITORING / READY
- Take-Counter
- `toggleRec()` aus Store — keine eigene Logik

## 8 Parameter (Acht-Regler-Regel)

| Parameter | Range | Store Action |
|-----------|-------|-------------|
| Pitch | -24..+24 st | `setPartPitch` |
| Volume | 0-100 | `setPartVolume` |
| Pan | -50..50 | `setPartPan` |
| Formant | 0-100 | `setChannel(filterFreq)` |
| Stretch | 0-100 | `setWaveEdit(stretch)` |
| Drive | 0-100 | `setWaveEdit(drive)` |
| Reverb | 0-100 | `setSend(0)` |
| Delay | 0-100 | `setSend(1)` |

## AI Vocal Assistant

| Tool | Funktion | Angewendet via |
|------|----------|----------------|
| PITCH | Scale-basierte Pitch-Korrektur | `setNotes` |
| HARMONY | Diatonische Terz-Harmonie | `setNotes` |
| LAYER | Oktav-Double | `setNotes` |
| PHRASE | Neue Phrase in Skala | `setNotes` |

- Alle AI-Vorschläge optional und rückgängig
- Kontextbezogen (liest Harmony aus ArpEngine)
- Deterministisch (seed-basiert)

## Take-Verwaltung

- Liste aller Noten im aktuellen Scene für den ausgewählten Part
- Pro Take: Step, Pitch, Length, Velocity, Delete-Button
- "CLEAR ALL" leert alle Takes