# Band V — UX Constitution

**VibeCore Univers · SUPREMÉ MASTERPROMPT**

---

## Grundsatz

> Der Benutzer soll vergessen, dass er Software benutzt.  
> Jede Berührung erzeugt unmittelbar musikalisches Feedback.  
> Die Technologie bleibt unsichtbar.

---

## Hardware Feeling

VibeCore soll sich anfühlen wie ein professionelles Hardware-Gerät.

### Was das bedeutet

| Aspekt | Hardware Feeling | Verboten |
|--------|-----------------|---------|
| Reaktion | Sofort, keine wahrnehmbare Latenz | Spinner / Loading States |
| Feedback | Taktil + visuell gleichzeitig | Feedback nur nach Klick |
| Navigation | Direkt, keine Trichter | Wizard-Dialoge |
| Fehler | Graceful Degradation | Fehler-Popups |
| Einstellungen | Immer sichtbar, niemals versteckt | Einstellungs-Menüs |

### Visuelle Sprache

- Dunkles Interface (OLED-optimiert)
- Neon-Akzentfarben auf dunklem Hintergrund
- Hardware-inspizierte Elemente: LCD-Displays, LEDs, Knöpfe, Schieberegler
- Monospace-Typo für Werte, Display-Typo für Labels

---

## One Touch

> Jede Hauptfunktion ist mit **maximal einer Berührung** erreichbar.

### Umsetzungsregeln

| Regel | Beschreibung |
|-------|-------------|
| Max. 1 Nav-Tiefe | Keine Unterseiten unter Unterseiten |
| Keine Bestätigungsdialoge | Für Standard-Aktionen |
| Kein Feature an zwei Orten | Jede Funktion hat genau einen Ort |
| Keine versteckten Zustände | Aktive Funktion ist immer sichtbar |
| Kein Scrolling für Kernfunktionen | Alles Wesentliche above the fold |

### Touch-Ziel-Mindestgrößen

| Element | Mindestgröße |
|---------|-------------|
| Buttons (kritisch) | 44 × 44 pt |
| Buttons (normal) | 36 × 36 pt |
| Slider-Thumb | 44 × 44 pt |
| Pad-Buttons | 64 × 64 pt |

---

## Five Second Rule

> Vom App-Start bis zum ersten musikalischen Sound: **maximal 5 Sekunden**.

### Pflicht-Aktionen ≤ 5 Sekunden

- Drum-Groove erstellen und abspielen
- Bass-Pattern starten
- Synth-Note spielen
- Effekt anwenden
- Live-Performance starten

### Was verboten ist

- Registrierungspflicht vor erstem Sound
- Onboarding-Flow vor Hauptfunktion
- Pflicht-Setup-Dialog vor Nutzung
- Initialisierungs-Screens > 1 Sekunde

---

## Mobile First

VibeCore ist primär für **Smartphones und Tablets** entwickelt.

### Screen-Strategie

| Gerät | Primäre Verwendung |
|-------|-------------------|
| Phone (360–430 pt) | Live Performance, Groove, ARP |
| Tablet (768–1024 pt) | Full DAW Workflow, Piano Roll, Mix |

### Responsive Breakpoints

| Breakpoint | Anpassung |
|------------|-----------|
| < 480 pt | Kompakte Ansicht, reduzierte Labels |
| 480–768 pt | Standard-Mobile-Layout |
| > 768 pt | Erweiterte Tablet-Ansicht |

### Mobile Performance

- 60 FPS auf Mittelklasse-Geräten (Snapdragon 7xx+)
- Keine Jank bei Audio-Callbacks
- Adaptive Quality (AUTO/HIGH/MEDIUM/LOW)

---

## Touch Gestures

Alle Gesten folgen einem **konsistenten, vorhersehbaren Muster**.

### Unterstützte Gesten

| Geste | Standard-Aktion |
|-------|----------------|
| Tap | Aktivieren / Auslösen |
| Double Tap | Alternative Aktion / Zurücksetzen |
| Hold | Kontextoptionen (inline, kein Popup) |
| Drag | Wert ändern / Verschieben |
| Pinch | Zoom (Piano Roll, Wellenform) |
| Multi Touch | Gleichzeitige Pad-Aktivierung |
| Swipe Up | Drawer öffnen (GROOVE, Pattern) |
| Swipe Down | Drawer schließen |
| Swipe Left/Right | Tab-Wechsel innerhalb eines Moduls |

### Gesture-Konsistenzregeln

- Gleiche Geste = immer gleiche Bedeutung im gleichen Kontext
- Keine Geste ist kontextabhängig mehrdeutig
- Alle Gesten haben visuelles Feedback (mindestens Highlight)

---

## Accessibility

### Mindestanforderungen

| Standard | Anforderung |
|----------|-------------|
| Kontrastverhältnis Text | ≥ 4,5:1 (WCAG AA) |
| Kontrastverhältnis UI-Komponenten | ≥ 3:1 |
| Touch-Zielgrößen | ≥ 44 × 44 pt |
| Screen Reader | Alle interaktiven Elemente mit `aria-label` |
| Farbunabhängigkeit | Keine Information nur über Farbe |

### Audio Accessibility

- Keine audio-only Information (immer visuelles Äquivalent)
- Visueller Beat-Indikator (für hörgeschädigte Benutzer)
- Konfigurierbare Metronom-Anzeige

---

## Navigation — Konsistenzregeln

### Bottom Navigation (Primär)

- 9 Module im Bottom Nav (scrollbar)
- Immer sichtbar, niemals ausgeblendet
- Aktives Modul hervorgehoben (LED + Farbe)
- Sub-Tabs erscheinen über der Bottom Nav (kontextabhängig)

### Modul-Hierarchie

```
Bottom Nav (9 Module)
    └── Sub-Tabs (2–5 pro Modul, wenn vorhanden)
            └── Inline Controls (keine weitere Ebene)
```

**Maximale Tiefe: 2 Ebenen.**  
Niemals 3 Ebenen.

### Kanonische Modulreihenfolge

| Position | Modul | Icon |
|----------|-------|------|
| 1 | HOME | Home |
| 2 | GROOVE | Layers |
| 3 | 3D SYNTH | Orbit |
| 4 | 3D BASS | Zap |
| 5 | SAMPLE FORGE | Disc |
| 6 | FX MIX LAB | Sliders |
| 7 | VOICE | Mic |
| 8 | AI | Bot |
| 9 | WAVE | Waves |
| 10 | SETTINGS | Settings |

---

## Design System

### Farben

| Rolle | Beschreibung |
|-------|-------------|
| Primary | Cyan (Haupt-Akzent, aktive Elemente) |
| Accent | Lila/Magenta (sekundäre Highlights) |
| Neon Lime | Positive Status (Audio Ready, Playing) |
| Neon Amber | Warnung (Queue, Mittelqualität) |
| Neon Crimson | Record, Fehler, Stop |
| Surface | Dunkle Hintergrundschichten |
| Border | Subtile Trennlinien |

### Typographie

| Rolle | Schrift | Verwendung |
|-------|---------|-----------|
| Display | Font-Display | Labels, Module-Namen, Buttons |
| Mono | Font-Mono | Werte, BPM, Steps, Metriken |
| Body | System | Beschreibungen, AI-Vorschläge |

### Komponenten-Invarianten

- Alle Buttons: `panel-inset` oder `panel` als Basis
- Alle Werte: Monospace, tabellarisch ausgerichtet
- Alle aktiven Zustände: Cyan Highlight + LED-Dot
- Alle Record-Zustände: Crimson + Puls-Animation
- Alle Meter: Gradient (Primary → Accent → Crimson)

### TopBar (immer sichtbar)

Enthält ausschließlich:
- Logo + Version
- BPM + TAP
- Pattern-Indikator
- Audio-Status
- Master Volume + Meter
- Transport (REC · STOP · PLAY)
- Qualitäts-Indikator
- Diagnostics-Button

**Keine Modul-spezifischen Controls im TopBar.**

---

## WORKFLOW FIRST POLICY — oberstes Gate dieser Verfassung

> **Der Workflow ist das Produkt.**

Dieses Gate ist **vor jedem anderen Review** zu durchlaufen.  
Kein Feature-Code, keine Architekturentscheidung, keine Implementierung ohne **WORKFLOW APPROVED**.

### Verbindliche Entwicklungsreihenfolge

| Phase | Bereich |
|-------|---------|
| 1 | Workflow |
| 2 | UI |
| 3 | UX |
| 4 | Live Performance |
| 5 | Architekturprüfung |
| 6 | Implementierung |
| 7 | Integration |
| 8 | Tests |
| 9 | Performanceoptimierung |
| 10 | Release |

### Workflow Gate — alle 7 Fragen müssen Ja ergeben

| # | Frage |
|---|-------|
| 1 | Ist sie in maximal 5 Sekunden erreichbar? |
| 2 | Ist sie mit einer Hand bedienbar? |
| 3 | Ist sie im Livebetrieb ohne Nachdenken nutzbar? |
| 4 | Ist sie auf Smartphone und Tablet gleichermaßen ergonomisch? |
| 5 | Kann sie während einer Performance sofort gefunden werden? |
| 6 | Benötigt sie maximal einen Touch oder eine klare Geste? |
| 7 | Vermeidet sie unnötige Navigation? |

**Eine Frage mit Nein → UI neu entwerfen. Kein Code vorher.**

### WORKFLOW FIRST — Pflicht vor jeder Codeänderung

1. Analysiere den Workflow.
2. Identifiziere doppelte Funktionen.
3. Entferne unnötige Navigation.
4. Reduziere Klicks und Gesten.
5. Prüfe den Live-Workflow.
6. Entwerfe die optimale UI.
7. Executive Board Freigabe einholen.

**Erst danach darf Code implementiert werden.**

---

## UX Review Checkliste

Vor jedem Feature-Release (nach WORKFLOW APPROVED):

| # | Frage |
|---|-------|
| 1 | Workflow Gate bestanden (alle 7 Ja)? |
| 2 | Ist die Funktion in ≤ 1 Touch erreichbar? |
| 3 | Gibt es visuelles Feedback innerhalb von 16 ms? |
| 4 | Ist kein Popup/Dialog nötig? |
| 5 | Ist die Funktion auf 360 pt Phone-Breite nutzbar? |
| 6 | Sind alle Touch-Ziele ≥ 44 pt? |
| 7 | Ist die Funktion ohne Anleitung verständlich? |
| 8 | Ist die Funktion konsistent mit ähnlichen Modulen? |
| 9 | Kann ein Musiker in 5 Sekunden damit Musik machen? |

---

*Band V — UX Constitution · VibeCore Univers SUPREMÉ MASTERPROMPT*
