# MODULE UI — ARP

**Performance-Arpeggiator · Sofort spielbar · Live editierbar**
**Status:** Production Ready

---

## Übersicht

Der ARP-Tab ist ein Performance-Arpeggiator. Er ist sofort spielbar und live editierbar. Alle Parameteränderungen greifen in Echtzeit (SceneStep-Level).

### Aufbau
- Arp Enable/Disable
- Mode-Auswahl (UP, DOWN, UPDOWN, RANDOM, CHORD, SPIRAL, ORBIT, DNA)
- Gate-Step Grid (16 Steps — bestimmt welche SceneSteps Noten erzeugen)
- Parameter-Panel (max 8 sichtbar)

## Parameter (max 8)

| Parameter | Range | Beschreibung |
|-----------|-------|--------------|
| Mode | 8 Werte | Arp-Richtungsmuster |
| Complexity | 0-100 | Note-Dichte, Oktav-Sprünge, Ratchets |
| Root Note | MIDI | Grundton (C2=36) |
| Scale | 5 Werte | minor, major, phrygian, minorPent, majorPent |
| Octaves | 1-4 | Oktav-Spanne |
| Vibe Control | 0-100 | Density-Faktor |
| State | 3 Werte | Clean / Smart / Hard |
| Gate Steps | 16 Bool | Step-Grid für Note-Triggering |

## TopBar Quick-Access

Die TopBar bietet direkten Zugriff auf:
- Arp Mode (SPIRAL / ORBIT / DNA)
- Complexity Slider

So kann der Nutzer während der Performance den Arp steuern, ohne den Tab zu wechseln.

## Live-Performance

- Parameteränderungen greifen beim nächsten SceneStep
- Keine Audio-Unterbrechung
- Kein Re-Init nötig