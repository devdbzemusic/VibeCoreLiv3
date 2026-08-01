# MASTERPROMPT BAND 3 — Coding Standards & Realtime Rules

**VibeCoreLiv3 · Coding Standards, Realtime Rules & Implementation Discipline**

> **Status:** Verbindlich (operatives Regelwerk) · **Gilt ab:** 2026-07-31 · **Adressat:** Base44 / Codex / Implementierungs-Board
> **Bezug:** Setzt Band 1 (Arbeitsmodus) und Band 2 (Plattformarchitektur) fort. Definiert die verbindlichen Entwicklungsregeln für die Umsetzung. Operative Referenz: `CODING_REALTIME_RULES.md`.

---

## 1. Zweck dieses Bands

Band 1 definiert den Arbeitsmodus. Band 2 definiert die Plattformarchitektur. Band 3 definiert jetzt die **verbindlichen Entwicklungsregeln** für die Umsetzung: wie Code in VibeCoreLiv3 geschrieben, erweitert, refaktoriert, getestet und dokumentiert wird. Es ist das operative Regelwerk für alle späteren Modul-Masterprompts.

---

## 2. Verbindlicher Grundsatz

VibeCoreLiv3 ist eine Realtime-Audio-Plattform. Das bedeutet:

- technische Disziplin vor Geschwindigkeit
- Realtime-Sicherheit vor Komfort
- klare Modulgrenzen vor improvisierten Abkürzungen
- messbare Qualität vor subjektivem Eindruck
- stabile Architektur vor kurzfristiger Bequemlichkeit

Jede Codeänderung muss an dieser Realität gemessen werden.

---

## 3. Allgemeine Coding-Prinzipien

### 3.1 Bestehenden Code bevorzugen
Eine funktionierende Struktur wird analysiert, erweitert, präzisiert oder gezielt refaktoriert. **Nicht erlaubt:** eine zweite parallele Lösung nur aus Bequemlichkeit.

### 3.2 Kleine, nachvollziehbare Änderungen
Bevorzugt: gezielte Patches, klar abgegrenzte Dateien, kleine überprüfbare Refactorings, isolierte fachliche Verbesserungen.
Verboten: unkontrollierte Großumbauten ohne Architekturbezug, breit gestreute Nebenänderungen, verschleierte Massenrefactorings ohne Notwendigkeit.

### 3.3 Klarheit vor Cleverness
Bevorzugt: explizite Datenflüsse, einfache Kontrollpfade, klare Benennungen, nachvollziehbare Zustandsänderungen.
Vermieden: unnötig komplexe Abstraktionen, überclevere Kurzlösungen, versteckte Seiteneffekte, schwer nachvollziehbare Magie.

---

## 4. Sprach- und Runtime-Regeln

### 4.1 TypeScript / ESM
Verbindlich: **keine** `require()`, **kein** CommonJS als Laufzeitmuster, **keine** impliziten Modulsystem-Mischungen, dynamische Imports nur dort, wo sie architektonisch sinnvoll sind.

### 4.2 Typdisziplin
Typen sind Vertragsstruktur. Erwartet: präzise Typen, klare Interfaces, sauber definierte Unions, **keine** unnötigen `any`, **keine** unkontrollierten Casts, **keine** stillen Typverletzungen.

### 4.3 Trennung von Daten und Verhalten
Datenmodelle sollen klar, serialisierbar, testbar, stabil versionierbar sein. Verhalten gehört in explizite Services, Adapter oder Engine-Komponenten.

---

## 5. Realtime-Regeln (zwingend)

### 5.1 Kein UI-Thread-Audio
Audio-, DSP- und Timing-Operationen dürfen **niemals** vom UI-Thread abhängen. Verboten: Audioverarbeitung im UI, Blocking Calls im UI die den Audiofluss betreffen, UI-getriebene Taktung, Zustandslogik die den Audiopfad indirekt blockiert.

### 5.2 Audiopfad frei von Allokationen
Im kritischen Realtime-Pfad nach Möglichkeit **keine** Heap-Allokationen. Verboten: unnötige Objekt-Erzeugung, dynamische Datenstrukturen ohne Kontrolle, blockierende Locks, Dateizugriffe, Logging mit Lastspitzen, schwer vorhersehbare Nebeneffekte.

### 5.3 Determinismus
Reale Audio- und Timing-Entscheidungen müssen deterministisch sein: gleiche Eingabe → gleicher Ablauf; gleiche Transportlage → gleiche Triggerlage; gleiche Parameter → gleiches Ergebnis. Wo Vollständigkeit nicht möglich ist, muss die Nichtdeterministik kontrolliert, dokumentiert und gemessen werden (z. B. `humanize` über seedgesteuerte Rng).

### 5.4 Lock-Disziplin
Locking im Realtime-Kontext nur, wenn technisch unvermeidbar und sicher. Bevorzugt: lock-freie Strukturen, atomare Zustandsübergänge, Double-Buffering, event-basierte Übergaben.

---

## 6. Audio- und DSP-Regeln

### 6.1 DSP ist modular
Jeder DSP-Baustein bleibt ein klarer fachlicher Baustein. Verboten: unstrukturierter DSP-Sammelklotz, versteckte DSP-Ketten in UI-Komponenten, modulübergreifender DSP-Code ohne Vertrag.

### 6.2 Echtzeitfähige Parameter
Parameteränderungen dürfen den Audiopfad nicht destabilisieren. Erlaubt: kontrollierte Übertragung, Smoothing, automation-geeignete Aktualisierung, definierte Reaktionszeit. Verboten: harte Sprünge ohne Plan, unkontrollierte Parameterfluten, Parameterlogik im UI-Renderpfad.

### 6.3 Modulation und Timing
Modulations- und Sequenzierungsdaten müssen sauber getrennt zwischen Transport · Scheduler · DSP · Voice-Layer · UI sein.

---

## 7. State- und Persistenzregeln

### 7.1 Ein Zustand pro Verantwortung
Jede Zustandsart ist klar einzuordnen: Realtime · Session · Project · Asset · Diagnostic · UI. Diese Schichten dürfen nicht vermischt werden.

### 7.2 Persistierbare Daten müssen versionierbar sein
Gilt für Store-Slices, Projektformate, Presets, Containerdaten, modulare Metadaten.

### 7.3 Kein doppelter State-Kern
Ein Zustand wird nicht gleichzeitig an mehreren Stellen als Wahrheit gepflegt, wenn das Inkonsistenzen erzeugt. **Eine Quelle der Wahrheit pro Datenbereich.**

---

## 8. Benennungsregeln

### 8.1 Fachliche Klarheit
Namen müssen die Fachrolle erkennen lassen. Bevorzugt: `transport`, `scheduler`, `pattern`, `scene`, `voiceAllocator`, `sampleForge`, `mixBus`, `projectFormat`, `containerManifest`.

### 8.2 Einheitlichkeit
Die gleichen Dinge werden gleich benannt. Keine parallelen Begriffe für dasselbe Konzept / denselben Zustand / denselben fachlichen Vorgang.

### 8.3 Vermeidung von Begriffsrauschen
Keine Namen, die nur dekorativ wirken, nur intern verständlich sind oder fachliche Bedeutung verschleiern.

---

## 9. Datei- und Modulschnitt-Regeln

### 9.1 Fachlich begrenzte Dateien
Eine Datei = eine klar erkennbare Hauptaufgabe. Ein Modul = klarer Verantwortungsbereich. Ein Service = klar definierte Aufgabe.

### 9.2 Keine Sammeldateien ohne Struktur
Große Sammeldateien nur, wenn architektonisch sauber gegliedert und wirklich nötig. Übernimmt eine Datei mehrere Rollen, ist das zu dokumentieren und technisch zu begründen.

### 9.3 Keine Schattenkopien
Nicht erlaubt: mehrere leicht unterschiedliche Versionen derselben Logik, Legacy-Doppelungen ohne Migrationsplan, stille Parallelimplementierungen.

---

## 10. Refactoring-Regeln

### 10.1 Refactoring nur mit Zweck
Zulässige Gründe: architektonische Notwendigkeit, Realtime-Stabilität, bessere Testbarkeit, klare Modulgrenzen, Datenintegrität, Performanceverbesserung. Keine kosmetischen Refactorings, die die Struktur destabilisieren.

### 10.2 Refactoring darf kein Funktionieren zerstören
Vorhandenes Funktionieren hat Priorität. Vorgehen: analysieren → gezielt umstellen → prüfen → dokumentieren.

### 10.3 Rückwärtskompatibilität bewahren
Wo möglich bleibt bestehendes Verhalten kompatibel. Bei unvermeidbaren Breaking Changes: begründen, versionieren, migrationsfähig machen, dokumentieren.

---

## 11. Testing-Regeln

### 11.1 Jede relevante Änderung braucht Prüfung
Je Bereich zu prüfen: Funktion, Stabilität, Realtime-Verhalten, Datenintegrität, Typen, Performance, UI-Auswirkung, Import/Export-Verhalten.

### 11.2 Fokus auf fachliche Tests
Besonders wichtig: Roundtrip-Tests, Migrations-Tests, Timing-Tests, Import-/Export-Tests, Routing-Tests, Persistenz-Tests, Realtime-Stabilitäts-Tests.

### 11.3 Tests dürfen die Audioarchitektur nicht verfälschen
Testcode darf nicht selbst zur neuen Architektur werden.

---

## 12. Dokumentationspflicht

Jede wesentliche Änderung muss dokumentiert werden. Inhalt: Was wurde geändert? Warum? Welche Architekturentscheidung? Welche Risiken? Welche Tests wurden ergänzt/verändert? Welche Auswirkungen auf Realtime, DSP, Persistenz, UX? Dokumentation ist Teil der technischen Arbeit, kein nachträglicher Luxus.

---

## 13. Qualitätsstandards

Jeder Codeabschnitt wird gemessen an: Lesbarkeit, Konsistenz, Realtime-Sicherheit, Testbarkeit, Erweiterbarkeit, Performance, Datenintegrität, Wartbarkeit, Fehlertoleranz, Zukunftsfähigkeit. Kurzfristig hilfreich, aber langfristig schädlich → ablehnen oder umbauen.

---

## 14. Umgang mit Risiken

Risiken werden nicht versteckt. Beispiele: Timing-Drift, Audio-Jitter, State-Kollision, Speicherwachstum, Lock-In im Realtime-Pfad, Inkompatibilität bei Migration, UI-/DSP-Kopplung, unklare Daten-Ownership. Risiken sind kein automatischer Stopp, müssen aber bewusst behandelt werden.

---

## 15. Performance-Regeln

### 15.1 Messen statt raten
Performance wird gemessen, nicht vermutet.
### 15.2 Keine stille Regression
Performance-Verschlechterung muss sichtbar sein.
### 15.3 Realtime-First
Performanceentscheidungen orientieren sich zuerst an: Audio-Thread-Stabilität, Timing, Latenz, Jitter, CPU-Spitzen, Speicherverhalten.

---

## 16. Plattform-Disziplin

Alle neuen Features müssen in die Plattformarchitektur passen: jedes Feature bekommt eine fachliche Heimat, jedes Modul bleibt anschlussfähig, jede neue Datei muss begründet sein, jede neue Abhängigkeit muss erlaubt sein, jede neue Schnittstelle muss dokumentiert sein.

---

## 17. Verbotene Entwicklungsformen

Nicht erlaubt: spontane Ad-hoc-Implementierungen ohne Architekturbezug, unkontrollierte Umbauten, versteckte Rückkanäle, globale Zustandsmischung, UI-getriebene Audiologik, Timing per Zufall, redundante Datenmodelle, unversionierte Persistenz, nicht dokumentierte Breaking Changes.

---

## 18. Verbindlicher Arbeitsstandard für spätere Module

Jedes spätere Modul-Masterprompt muss diese Regeln implizit mitführen: Modul-Prompts dürfen nicht gegen diese Standards arbeiten, müssen sie anwenden, dürfen sie nicht relativieren und dürfen keine Schattenarchitektur erzeugen.

---

## 19. Ziel dieses Bands

Band 3 sorgt dafür, dass VibeCoreLiv3 nicht nur architektonisch sauber gedacht, sondern auch technisch sauber umgesetzt wird. Es beantwortet: Wie wird geschrieben? Wie wird refaktoriert? Wie wird getestet? Wie wird dokumentiert? Wie wird Realtime geschützt? Wie wird Qualität gesichert? Damit wird aus Architektur tatsächliche Entwicklungsdisziplin.

---

## 20. Übergabe an Band 4

Band 4 definiert die QA-, Test- und Release-Regeln: Testhierarchie, Realtime-Benchmarks, Import-/Export-Validierung, Android-Performance-Gates, Release-Kriterien, Review-Mechanismen, Abnahmebedingungen. Ab diesem Punkt ist die Entwicklungsdisziplin vollständig formalisiert.