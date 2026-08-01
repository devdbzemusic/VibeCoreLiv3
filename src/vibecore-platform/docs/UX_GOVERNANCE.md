# UX_GOVERNANCE.md — VibeCoreLiv3 Projektweite Bedienphilosophie

**VibeCoreLiv3 · Workflow First – Features Second**
**Status:** Verbindlich für alle Module · **Stand:** 2026-07-31

Diese Richtlinie definiert die verbindliche Bedienphilosophie für alle VibeCoreLiv3-Module (Synth, Bass, Groove, Sample Forge, FX, Voice, AI, Remix). Sie ist Teil der Governance (Band 1–4) und muss von jedem neuen Modul eingehalten werden.

---

## 1. Leitprinzipien

1. **Maximal 3 Aktionen bis ein Sound spielbar ist.** Der Nutzer wählt ein Instrument, sieht sofort einen Audition-Button und hört ein Ergebnis.
2. **Ein Regler = eine eindeutige Funktion.** Keine versteckten Doppelfunktionen, keine kontextabhängigen Mehrfachbelegungen.
3. **Sofort hörbares Feedback bei jeder Änderung.** Jede Parameteränderung ist auditierbar — der Audition-Button ist jederzeit sichtbar.
4. **Keine Menüverschachtelung für Standardaufgaben.** Standard-Parameter sind direkt sichtbar, nicht hinter Sub-Menüs.
5. **Live-Performance muss jederzeit ohne Unterbrechung möglich sein.** Keine blockierenden Dialoge, keine Page-Reloads, keine Modal-Sperren im Performance-Pfad.
6. **Einheitliche Bedienlogik in allen Modulen.** Synth, Bass, Groove und Sample Forge nutzen dieselben UI-Primitive (Knob, Toggle, Section-Header, Audition-Button).
7. **Kontextabhängige Bedienelemente.** Nur relevante Parameter sind sichtbar. Irrelevante Sektionen werden ausgeblendet, nicht nur deaktiviert.
8. **Expertenfunktionen einklappbar.** Einsteiger werden nicht überfordert — Modulationsmatrix, Makros, erweitertes Routing sind in einklappbaren Sektionen.

---

## 2. Standard-Workflow (Electribe-Style)

Jedes Instrument-Modul folgt diesem Workflow:

```
SOUND → OSCILLATOR → FILTER → ENVELOPE → RAUM/3D → FX → SPEICHERN
```

1. **Sound auswählen** — Preset-Auswahl oder leeres Patch
2. **Oszillator einstellen** — Wellenform, Oktave, Pegel, Pan
3. **Filter** — Typ, Frequenz, Resonanz
4. **Hüllkurve** — ADSR (Attack, Decay, Sustain, Release)
5. **3D-Raum** — Spatial-Mode, Width, Position
6. **FX** — Send-Level zu FX-Bussen
7. **Speichern** — Snapshot speichern/laden

**Alles Weitere** (Modulationsmatrix, Makros, Unison, erweiterte Routing-Optionen, Performance-Parameter) ist erst sichtbar, wenn der Nutzer es bewusst öffnet (einklappbare „Advanced"-Sektion).

---

## 3. UI-Primitive

| Primitive | Verwendung | Spezifikation |
|-----------|-----------|---------------|
| Knob | Einziger Parameter-Wert | Label, Wert-Anzeige, Range-Slider, Suffix |
| Toggle | Ein/Aus-Schalter | Label, Zustands-Indikator (neon-border bei aktiv) |
| Section-Header | Sektions-Titel | font-display, hairline-Divider |
| Audition-Button | Sofortiges Feedback | Gradient-Primary, vollbreit, ▶-Icon |
| Preset-Button | Preset-Auswahl | panel-inset, neon-border bei aktiv |
| Advanced-Collapse | Expertenfunktionen | Einklappbar, Default: eingeklappt |

---

## 4. Mobile-First

- Touch-Targets ≥ 44px für Kern-Interaktion
- Kein Hover-Only-Verhalten
- `touch-action: manipulation` auf interaktiven Elementen
- Horizontales Scrollen für Listen (Parts, Presets)
- Keine Desktop-only-Patterns (Tooltips, Drag-Drop für Touch)

---

## 5. Durchsetzung

Diese Richtlinie ist verbindlich. Neue Module müssen den Workflow einhalten. Module, die ihn verletzen, werden nicht freigegeben. Das unabhängige Review-Board prüft die UX-Compliance im Freigabeprozess.

---

## 6. Modul-spezifische Anwendung

### VibeCore 3D Synth
Workflow: Sound → Oszillator → Filter → Hüllkurve → 3D-Raum → FX → Speichern
Advanced (einklappbar): Unison, Modulationsmatrix, Makros, Performance

### Zukünftige Module
- **3D Bass:** Sound → OSC → Filter → Hüllkurve → 3D → FX → Save
- **Groove:** Sound → Pattern → Swing → Humanize → FX → Save
- **Sample Forge:** Sample → Slice → Stretch → Grain → FX → Save

Jedes Modul definiert seinen Workflow in seiner MODULE-Dokumentation und referenziert diese Richtlinie.