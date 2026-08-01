# MODULE UI — Workflow

**VibeCoreLiv3 UI Architect · Global Workflow Specification**
**Status:** Production Ready · Updated 2026-08-01

---

## Leitprinzip

**Workflow vor Optik.** Jede Oberfläche muss sich wie ein Instrument anfühlen — nicht wie Software, nicht wie eine Webseite, nicht wie eine Desktop-DAW. Der Benutzer darf niemals über die Bedienung nachdenken müssen.

## Drei-Berührungen-Regel

Jede Hauptfunktion muss innerhalb von höchstens drei Berührungen erreichbar sein.

| Funktion | Touches | Pfad |
|----------|---------|------|
| Beat erstellen | 2 | Arrange Hub → SEQ |
| Sound editieren | 2 | Sound Hub → SND |
| Pattern wechseln | 2 | Arrange Hub → ROLL |
| Arp spielen | 2 | Arrange Hub → ARP |
| Mix machen | 2 | Mix Hub → MIX |
| AI Vorschlag | 2 | Perform Hub → AI |
| Vocal aufnehmen | 2 | Sound Hub → VOICE |
| Remix bauen | 2 | Arrange Hub → REMIX |
| Transport Start/Stop | 1 | TopBar Play |
| BPM ändern | 1 | TopBar BPM |

## Acht-Regler-Regel

Es dürfen niemals mehr als acht Hauptparameter gleichzeitig sichtbar sein. Weitere Einstellungen werden logisch gruppiert, ohne den kreativen Fluss zu unterbrechen.

## Navigation

### Hub-basierte Navigation (5 Hubs)

| Hub | Tone | Sub-Tabs |
|-----|------|----------|
| ARRANGE | Cyan | SEQ, ROLL, ARP, REMIX |
| SOUND | Magenta | SND, SMPL, VOICE, LIB, PROD |
| MIX | Cyan | MIX, FX |
| PERFORM | Magenta | AI, BRN, SPC, SYNC |
| SYSTEM | Amber | SETUP, DBG |

### Einheitlicher Seitenaufbau

```
┌─────────────────────────────────────────┐
│ TopBar: Logo · BPM · Transport · Meters │
├─────────────────────────────────────────┤
│                                         │
│  Hauptbereich (Modul-spezifisch)        │
│  Nur die aktuell benötigten Werkzeuge    │
│                                         │
├─────────────────────────────────────────┤
│ TabBar: Hub-Dock + Sub-Tab-Strip        │
└─────────────────────────────────────────┘
```

## Live Workflow

Während laufender Wiedergabe möglich: Pattern wechseln, Instrumente editieren, Automation aufnehmen, Samples bearbeiten, Remix durchführen, AI-Vorschläge übernehmen — ohne Audio-Unterbrechung.

## Performance-Regeln

- UI blockiert niemals Audio
- Keine großen Listen permanent aktualisiert
- Animationen außerhalb des Audiopfads
- Mindestens 60 FPS auf Smartphone und Tablet