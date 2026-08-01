# MASTERPROMPT BAND 2 — Platform Architecture

**VibeCoreLiv3 · Platform Architecture: Module Contracts, Dependencies & Core Systems**

> **Status:** Verbindlich (Architekturgesetz) · **Gilt ab:** 2026-07-31 · **Adressat:** Base44 / Codex / Implementierungs-Board
> **Bezug:** Erweitert Band 1 (Arbeitsmodus & Ausführungsdisziplin). Die Plattformarchitektur ist hiermit festgelegt; Fachmodule bauen sauber darauf auf.

---

## 1. Zweck dieses Bands

Band 1 definiert den Arbeitsmodus, die Entscheidungslogik und die Ausführungsdisziplin.
Band 2 definiert jetzt die **Plattformarchitektur** von VibeCoreLiv3: wie die Hauptmodule aufgebaut sind, wie sie interagieren, welche Abhängigkeiten erlaubt sind und welche Schnittstellen verbindlich gelten.

Dieses Dokument ist das **Architekturgesetz** für die modulare Plattform.

---

## 2. Verbindliche Ausgangslage

Die Plattform basiert auf dem existierenden Projektstand von VibeCoreLiv3. Vorhanden sind bereits:

- Audio- und Sequencer-Strukturen
- Groovebox-Komponenten
- Mixer- und Routing-Anteile
- Sync-/Transport-nahe Teile
- Sample- und Forge-Elemente
- AI-bezogene Module
- Android-native Vorbereitung
- Diagnostics und Performance-Werkzeuge
- `.vcl3`-Projektformat und Container-Struktur

Daraus folgt: **keine** neue Parallelarchitektur, **keine** Doppelmodule, **keine** Ersatzsysteme ohne zwingenden technischen Grund, **keine** Abstraktion ohne echten Nutzen, **keine** modulübergreifenden Direktabhängigkeiten ohne Vertrag.

---

## 3. Plattformziel

VibeCoreLiv3 ist eine modulare Audio-Plattform mit klaren Fachsystemen. Anforderungen:

- Echtzeitfähigkeit · stabile Synchronisation · klare Modulgrenzen · native Audio-Performance
- erweiterbare Architektur · saubere Persistenz · reproduzierbares Verhalten
- klare Zustandsmodelle · testbare Interfaces · langfristige Skalierbarkeit

Die Plattform ist **kein Monolith**, sondern ein koordiniertes System spezialisierter Module.

---

## 4. Modulübersicht der Plattform

Die verbindlichen neun Kernmodule:

1. VibeCore Sync
2. VibeCore Groove
3. VibeCore 3D Synth
4. VibeCore 3D Bass
5. VibeCore FX Mix Lab
6. VibeCore Sample Forge
7. VibeCore Voice
8. VibeCore AI
9. VibeCore Remix

Jedes Modul hat eigene Verantwortung, eigene Datenpfade und eigene Testkriterien.

---

## 5. Architekturprinzipien

### 5.1 Eine Plattform, viele Fachsysteme
Jedes Modul hat einen klaren Zweck, eine definierte API, ist einzeln testbar, stützt sich auf gemeinsame Plattformdienste und erzeugt **keine** verdeckten Rückkanäle.

### 5.2 VibeCore Sync ist die Zeitbasis
Einzige globale Zeitquelle. Erlaubt: BPM, Transport, Song-/Pattern-/Scene-Position, MIDI-Sync, Start/Stop/Continue, Quantisierung, Scheduler-Callbacks.
Verboten: konkurrierende Clocks, lokale Zeitinseln, versteckte Modul-Timer als Hauptquelle, unsynchronisierte Transportlogik.

### 5.3 DSP ist nicht der UI-Partner
UI darf Parameter setzen, Status anzeigen, Ereignisse auslösen, Metadaten lesen. UI darf **nicht**: Audio berechnen, Realtime-Entscheidungen erzwingen, Timing definieren, den Audiopfad blockieren.

### 5.4 Module kommunizieren über Verträge
Nur über definierte Interfaces, klar beschriebene Datenstrukturen, Zustandsänderungen über das Host-System, kontrollierte Ereignisse, testbare Übergaben.
Verboten: Direktzugriffe auf fremde interne Zustände, implizite Seiteneffekte, globale Schattenzustände, modulübergreifende Ad-hoc-Verkettungen.

### 5.5 Keine Doppelimplementierungen
Existierende Funktionen werden erweitert oder gezielt refaktoriert. Nicht erlaubt: zweite Clock, zweiter Mixer, zweiter Exportpfad, zweites Sample-Format, zweite Projektlogik, zweite Mixer-State-Logik.

---

## 6. Plattformschichten

1. UI / Workflow Layer
2. Host / Application Layer
3. Module Layer
4. Sync Layer
5. DSP Layer
6. Audio Engine Layer
7. Native Platform Layer
8. OS / Device Layer

**Datenfluss (bevorzugt):** UI → Host → Module → Sync → DSP → Audio Engine → Native Platform.

**Rückkanäle** nur für: Metering, Diagnostics, State-Reflection, Persistenz, UI-Anzeige.

---

## 7. Gemeinsame Plattformdienste

Alle Kernmodule dürfen auf diese gemeinsamen Dienste zugreifen:

| Dienst | Zuständig für |
|--------|---------------|
| **7.1 Transport Service** | Play / Stop / Continue / Jump / Chain / Pattern-Wechsel / Scene-Wechsel / Song Mode |
| **7.2 Clock / Scheduler Service** | zeitliche Ausführung, Look-ahead, Quantisierung, Trigger-Planung, präzise Synchronisation |
| **7.3 State Service** | zentralen Zustand, Projektzustand, globale Auswahl, Persistenzschnittstellen, Undo-/Redo-fähige Zustandsänderungen |
| **7.4 Audio Graph Service** | Quellen↔Senken, Signalrouting, Busse, Sends, Returns, Master-Struktur |
| **7.5 Asset Service** | Samples, Presets, Patches, Plugin-Daten, Container-Assets, Metadaten |
| **7.6 Diagnostics Service** | Performance-Messung, Timing-Analyse, Realtime-Monitoring, Audio-Jitter, CPU-/Buffer-Status, Fehlerzustände |

---

## 8. Moduldefinitionen

### 8.1 VibeCore Sync — zentrale Zeit- und Transportinstanz
**Verantwortungen:** Clock · BPM · Transport · Song/Pattern/Scene Position · Scheduler · MIDI Sync · Start/Stop/Continue · Quantisierung · Follow/Chain.
**Regeln:** Sync darf nicht vom UI abhängen; nicht von Audioeffekten; nicht von Modulinteraktionen destabilisierbar; ist die einzige globale Referenz für zeitkritische Entscheidungen.
**Daten:** BPM · PPQ/Timing-Resolution · Transport State · Chain State · Scheduled Events · Sync Mode · External Sync Flags.
**Tests:** Drift · Quantisierung · Song-Position · Transport Start/Stop · Langzeitstabilität · External Sync.

### 8.2 VibeCore Groove — Sequencer- und Pattern-Bereich
**Verantwortungen:** Step Sequencing · Piano Roll · Pattern/Scene Editing · Probability · Ratchets · Parameter Locks · Conditional Trigs · Swing · Humanize · Song Mode · Groove Variants.
**Regeln:** nutzt Sync als Zeitquelle; erzeugt keine eigene Clock; Sequencer-Entscheidungen deterministisch und testbar; UI spiegelt nur, takten nicht.
**Daten:** Patterns · Parts · Scenes · Steps · Notes · Automation · Probability · Trigger-Zustände · Groove-Parameter.
**Tests:** Step-Accuracy · Probability-Statistik · Ratchet-Timing · Pattern-/Scene-Transitionen · Humanize-Konsistenz · Song-Mode.

### 8.3 VibeCore 3D Synth — modulares Synthesizersystem
**Verantwortungen:** Polyphone Synthese · Oszillatoren · Filter · Envelopes · Modulation · Voice Management · Spatial/3D-Parameter · Klangformung.
**Regeln:** DSP-seitig sauber und modular; Voices dürfen nicht unkontrolliert wachsen; Modulationen nachvollziehbar/testbar; Spatial-Parameter destabilisieren Realtime nicht.
**Daten:** Voice-States · Oscillator/Filter/Envelope-Configs · Modulationsmatrix · Presets · Macro-Zuweisungen.
**Tests:** Polyphonie · Voice-Stealing · Modulationskorrektheit · Filterverhalten · Preset-Reproduzierbarkeit · CPU-Verhalten.

### 8.4 VibeCore 3D Bass — bassoptimiertes Synth-System
**Verantwortungen:** Sub-/Mid-Bass · harmonische Stabilität · psychoakustische Tiefe · kontrollierte Saturation · Low-End-Optimierung · bassspezifische Performance-Parameter.
**Regeln:** kein generischer Synth-Sumpf; eigene Klang- und Performance-Parameter; Low-End reproduzierbar und stabil.
**Daten:** Bass-Voices · Subharmonische · Saturation · Drive · Filter · Sidechain · Bass-Presets.
**Tests:** Tiefenstabilität · Phase · CPU · Low-End-Consistency · Preset-Vergleich · Realtime-Last.

### 8.5 VibeCore FX Mix Lab — Mix- und Routing-Bereich
**Verantwortungen:** Mixer · Channel Strips · Inserts · Sends · Returns · AUX · Bus Routing · Sidechain · Pan · Gain · Metering · Mastering-nahe Kontrolle.
**Regeln:** Routing klar und nachvollziehbar; kein implizites Routing; keine versteckten Busses; Metering beobachtend, nicht steuernd; FX blockieren Realtime nicht.
**Daten:** Channel-State · Bus-State · Send-Level · Insert-Chain · Master-State · Metering · Routing-Matrix.
**Tests:** Routing-Korrektheit · Send/Return · Sidechain · Metering-Konsistenz · Bypass · Master-Output-Stabilität.

### 8.6 VibeCore Sample Forge — Sample- und Transformations-Engine
**Verantwortungen:** Sampleverwaltung · Recording · Streaming · Slice · Time Stretch · Pitch Shift · Reverse · Looping · Analyse · Einbettung in Projekte/Container.
**Regeln:** große Samples streamen; kleine einbetten; daten-/speicherbewusst; Analyse blockiert Audio-Thread nicht.
**Daten:** Sample-Metadaten · Pfade/eingebettete Daten · Slice-Maps · Stretch/Pitch/Loop-Parameter · Analyseergebnisse.
**Tests:** Streaming-Stabilität · Slice · Time-Stretch · Pitch · Import/Export · Speicherverbrauch.

### 8.7 VibeCore Voice — Vocal- und Stimmverarbeitung
**Verantwortungen:** Pitch Processing · Formant Processing · Harmonizer · Vocoder-nahe Funktionen · Voice-Workflows · sprachbasierte Klangmodulation.
**Regeln:** eigener Fachbereich; nicht in generischen FX-Bussen verschwinden; Formant/Pitch musikalisch nutzbar; UI/DSP getrennt.
**Daten:** Voice-Presets · Pitch/Formant/Harmony-Parameter · Voice-Chain · Input-/Output-Handles.
**Tests:** Pitch-Tracking · Formant-Stabilität · Harmonizer-Kohärenz · Latenz · CPU · Preset-Reproduktion.

### 8.8 VibeCore AI — assistierende Kreativ- und Analyse-Engine
**Verantwortungen:** Sounddesign-Hilfen · Pattern-Vorschläge · Mix-Hinweise · Projektanalyse · generative Assistenz · Workflow-Optimierung.
**Regeln:** Assistenz, nicht Kontrollinstanz; blockiert Realtime nie; greift nur über definierte Plattformdienste auf Daten zu; Ergebnisse nachvollziehbar und optional.
**Daten:** AI-Kontext · Analyseergebnisse · Vorschläge · Preset-Hinweise · Workflow-Hints · relevante Projektmetadaten.
**Tests:** deterministische Eingaben · Kontextkonsistenz · Performance · UI-Reaktionszeit · Nichtinvasivität · Fehlertoleranz.

### 8.9 VibeCore Remix — Remix- und Stem-Transformationsschicht
**Verantwortungen:** Arrangement-Transformation · Clip-basierte Bearbeitung · Remix-Workflows · Stem-Zerlegung · Live-Remix · Performance-Montage.
**Regeln:** arbeitet auf vorhandenen Projekt-/Asset-Daten; braucht saubere Container-/Projektdaten; führt keine verdeckte zweite Projektlogik ein; greift auf standardisierte Assets/Metadaten zu.
**Daten:** Stems · Remix-Metadaten · Clip-Graph · Transformationsstatus · Arrangement-Maps.
**Tests:** Stem-Kohärenz · Clip-Transformation · Arrangement-Stabilität · Import/Export-Kompatibilität · Performance unter Last.

---

## 9. Modulabhängigkeiten

**Erlaubt:**

- VibeCore Groove → VibeCore Sync
- VibeCore 3D Synth → VibeCore Sync
- VibeCore 3D Bass → VibeCore Sync
- VibeCore FX Mix Lab → VibeCore Sync + Audio Engine
- VibeCore Sample Forge → VibeCore Sync + Asset Service
- VibeCore Voice → VibeCore Sync + Audio Engine
- VibeCore AI → Host + State + Diagnostics
- VibeCore Remix → Asset Service + Project Format + Sync

**Nicht erlaubt:**

- Groove direkt an Remix koppeln
- Synth direkt an Sample-Container koppeln
- FX direkt an UI-State koppeln
- AI direkt an den Audiopfad koppeln
- Remix direkt an DSP-Interna koppeln
- Module untereinander mit internen Implementierungsdetails verbinden

---

## 10. Gemeinsame Datentypen

Project · Pattern · Scene · Part · Step · Note · Voice · Sample · Preset · Bus · Send · Return · Transport · Chain · Modulation · Metadata · Asset · Container · Diagnostics.

Konsistent verwendet. Keine Synonym-Chaos-Schicht, keine zweite Begriffswelt, keine impliziten Begriffswechsel zwischen UI und DSP.

---

## 11. Datenintegrität

- Ein Projekt hat eine eindeutige Identität (UUID).
- Jede Scene/jeder Pattern ist eindeutig adressierbar.
- Samples, Presets und Plugin-Daten sind referenzierbar.
- Importierte Daten werden validiert.
- Orphans werden bereinigt.
- Versionen migrierbar gehalten.

Verbindlich: keine losen Referenzen ohne Prüfung · keine stillen Datenverluste · keine unkontrollierten Merge-Zustände · keine unklare Asset-Ownership.

---

## 12. Architekturregeln für Persistenz

Ebenen (streng getrennt):

1. Realtime State
2. Session State
3. Project State
4. Asset State
5. Container State
6. Diagnostic State

Ein UI-Fehler darf nicht den Projektkern beschädigen; ein Importfehler nicht den Realtime-Pfad destabilisieren; ein temporärer Zustand nicht als Projektrealität persistiert werden.

---

## 13. Qualität und Prüfpflicht

Bewertung je Modul aus: Architektur · Realtime-Sicherheit · Performance · Speicherverhalten · Datenmodell · Testbarkeit · Erweiterbarkeit · UX-Relevanz · Integrationsfähigkeit · Fehlertoleranz. Schwächen werden dokumentiert und behoben.

---

## 14. Modulreife

Ein Modul gilt als ausreichend, wenn es: klar abgegrenzt ist · nicht mit anderen Modulen kollidiert · testbar ist · im Projektkontext nützlich ist · in die Plattformarchitektur passt · das Realtime-Verhalten nicht gefährdet.

---

## 15. Verbotene Architekturformen

Monolithischer Audio-Sammelcode · UI-gesteuerte Audioverarbeitung · doppelte Clock-Logik · doppelte Projektmodelle · ungeprüfte Direktzugriffe zwischen Modulen · globale Schattenzustände ohne Vertrag · unsaubere Abkürzungen, die spätere Erweiterung blockieren.

---

## 16. Arbeitsanweisung an das Board

1. Ordne jedes existierende oder neue Feature einem der neun Kernmodule zu.
2. Prüfe die Abhängigkeiten.
3. Halte VibeCore Sync als zentrale Zeitbasis ein.
4. Halte Datenmodelle konsistent.
5. Verhindere Doppelarchitekturen.
6. Dokumentiere jede modulare Entscheidung.
7. Priorisiere Realtime-Sicherheit und modulare Klarheit.
8. Erweitere nur dort, wo es architektonisch sauber ist.

---

## 17. Ziel dieses Bands

Band 2 beantwortet: Welche Module gibt es? Wofür sind sie zuständig? Wie sprechen sie miteinander? Welche Datenformen sind erlaubt? Welche Abhängigkeiten sind zulässig? Wie bleibt die Plattform erweiterbar?

Die Antwort ist die Grundlage für alle späteren Implementierungsbänder.

---

## 18. Übergabe an die nächste Phase

Nach diesem Band folgen die konkreten Implementierungsbänder:

- **Band 3** — Coding Standards & Realtime Rules
- **Band 4** — QA, Tests & Release Gates
- danach **modulbezogene Arbeitsbänder** pro Kernsystem

Die Plattformarchitektur ist hiermit festgelegt. Die Fachmodule können sauber darauf aufbauen.