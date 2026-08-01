# MASTERPROMPT BAND 4 — QA, Tests, Release Gates & Definition of Done

**VibeCoreLiv3 · QA, Tests, Release Gates & Definition of Done**

> **Status:** Verbindlich (Abschluss der Governance-Reihe) · **Gilt ab:** 2026-07-31 · **Adressat:** Base44 / Codex / Implementierungs-Board
> **Bezug:** Setzt Band 1 (Arbeitsmodus), Band 2 (Architektur), Band 3 (Entwicklungsdisziplin) fort und schließt die Governance-Reihe ab. Operative Referenz: `QA_RELEASE_GATES.md`.

---

## 1. Zweck dieses Bands

Band 1 definiert den Arbeitsmodus. Band 2 definiert die Plattformarchitektur. Band 3 definiert Coding Standards und Realtime-Regeln. Band 4 definiert jetzt die **Prüf-, Abnahme- und Release-Regeln** für VibeCoreLiv3: wie Arbeit validiert wird, wann ein Modul als fertig gilt, welche Tests verpflichtend sind und welche Kriterien für Freigaben gelten. Band 4 schließt die Governance-Reihe ab — ab hier gelten die operativen Regeln als vollständig formalisiert.

---

## 2. Verbindlicher Grundsatz

Eine Änderung gilt **nicht** als abgeschlossen, nur weil sie technisch eingebaut wurde. Sie ist erst vollständig, wenn sie: architektonisch sauber eingeordnet · funktional geprüft · Realtime-Verhalten nicht verschlechtert · Datenintegrität bewahrt · dokumentiert · den definierten Abnahmekriterien entspricht. **Funktion ohne Qualität ist kein Abschluss.**

---

## 3. Testphilosophie

VibeCoreLiv3 ist eine Realtime-Audio-Plattform. Tests prüfen nicht nur Logik, sondern auch: Timing-Stabilität · Audio-Verhalten · Performance · Speicherverhalten · Datenintegrität · Realtime-Sicherheit · Import-/Export-Korrektheit · Android-Verhalten · modulübergreifende Korrektheit. Tests dürfen nicht dekorativ sein — sie sind technische Kontrollinstanz.

---

## 4. Testhierarchie

Reihenfolge der Betrachtung:

### 4.1 Architektur- und Vertragsprüfungen
Modulgrenzen · erlaubte Abhängigkeiten · API-Verträge · Persistenzregeln · Formatregeln · Realtime-Disziplin.

### 4.2 Fachliche Funktionstests
korrekte Funktion einzelner Module · Datenfluss · Parameterverhalten · Rendering-/Routing-Verhalten · importierte/exportierte Zustände.

### 4.3 Realtime- und Timing-Tests
Scheduler-Verhalten · Clock-Verhalten · Transport-Verhalten · Timing-Genauigkeit · Drift · Jitter · Stabilität unter Last.

### 4.4 Performance-Tests
CPU-Verbrauch · Speicherverbrauch · Latenz · XRuns · Thread-Verhalten · Renderzeit · Skalierung bei hoher Last.

### 4.5 Integrations- und Systemtests
Modulinteraktion · Persistenz · Import/Export · Container/Format · Android-Native-Verhalten · Audio-Engine-End-to-End.

### 4.6 Regressionstests
ob eine neue Änderung frühere Funktionen beschädigt · ob bekannte Fehler zurückkehren · ob Versionierung und Migration weiterhin korrekt arbeiten.

---

## 5. Definition of Done

Ein Modul gilt nur dann als „done", wenn alle folgenden Kriterien erfüllt sind:

### 5.1 Funktional
Kernfunktion implementiert · Fachlogik vollständig · relevante Sonderfälle berücksichtigt · keine offensichtlichen Platzhalter.

### 5.2 Architektur
klar abgegrenzt · Abhängigkeiten erlaubt und dokumentiert · keine Plattformregelverletzung · keine Doppelimplementierung.

### 5.3 Realtime / Audio
Realtime-Pfad stabil · Audio-/Timing-Verhalten nicht verschlechtert · keine UI-Abhängigkeit im Audiopfad · keine blockierenden Operationen im kritischen Pfad.

### 5.4 Daten
Zustände konsistent · Persistenz versionierbar · Migrationen vorgesehen · Import/Export korrekt.

### 5.5 Tests
relevante Tests existieren und laufen erfolgreich · Kern- und Fehlerfälle abgedeckt · relevante Regressionen abgesichert.

### 5.6 Dokumentation
Änderungen · Risiken · Architekturentscheidungen · offene Punkte dokumentiert.

---

## 6. Modul-Abnahmekriterien

### 6.1 VibeCore Sync
Clock stabil · Transport konsistent · Start/Stop/Continue korrekt · Song-/Pattern-Positionen korrekt · Scheduler ohne Drift · externe und interne Sync-Pfade definiert.

### 6.2 VibeCore Groove
Sequencer triggert korrekt · Probability/Ratchets/Swing/Humanize korrekt · Pattern-/Scene-Wechsel deterministisch · Piano Roll und Step-Logik konsistent · Transportanbindung sauber.

### 6.3 VibeCore 3D Synth
Voice Management stabil · Synthese reproduzierbar · Modulation korrekt · Presets zuverlässig laden/speichern · Polyphonie und CPU-Verhalten kontrolliert.

### 6.4 VibeCore 3D Bass
Bass-Engine klanglich konsistent · Low-End stabil · Sub-/Mid-Verhalten kontrolliert · Presets zuverlässig · Performance und Phase geprüft.

### 6.5 VibeCore FX Mix Lab
Routing korrekt · Sends/Returns/Busse korrekt · Sidechain zuverlässig · Metering korrekt · Master-Verhalten stabil.

### 6.6 VibeCore Sample Forge
Streaming stabil · Slice/Pitch/Time Stretch korrekt · große Samples korrekt verarbeitet · importierte und eingebettete Assets konsistent · Speicherverhalten kontrolliert.

### 6.7 VibeCore Voice
Pitch-/Formant-Funktionen korrekt · vokale Verarbeitung musikalisch nutzbar · Latenz und CPU kontrolliert · Preset-Handling sauber.

### 6.8 VibeCore AI
Assistenz nicht invasiv · AI blockiert Realtime nicht · Kontext korrekt · Ergebnisse nachvollziehbar und optional.

### 6.9 VibeCore Remix
Stem-/Clip-/Arrangement-Transformationen korrekt · Remix-Workflows sauber · importierte Projekt-/Assetdaten korrekt · keine neue Schattenarchitektur.

---

## 7. Pflicht-Tests nach Änderungsart

### 7.1 Änderungen an Audio / DSP
Timing-Test · Audio-Stabilitätstest · Lasttest · Latenz-/Jitter-Analyse · Realtime-Sicherheitsprüfung.

### 7.2 Änderungen an Sync / Transport
Clock-Test · Transport-Test · Quantisierungs-Test · Pattern-/Scene-Wechsel-Test · Langzeitstabilitätstest.

### 7.3 Änderungen an Persistenz / Format / Container
Roundtrip-Test · Versions-/Migrationstest · Fehlerfalltest · Integritätstest · Kompatibilitätstest.

### 7.4 Änderungen an UI / Workflow
Interaktionstest · Zustandskonsistenztest · Reaktionszeitprüfung · Seiteneffektprüfung · Store-Kompatibilität.

### 7.5 Änderungen an Android / Native
Build-/Integrationsprüfung · Speicherprüfung · CPU-/Thread-Prüfung · Latenzprüfung · Gerätekompatibilitätsprüfung.

---

## 8. Realtime- und Performance-Budgets

### 8.1 Realtime-Budget
Im Audiopfad: **keine** unnötigen Allokationen · **keine** blockierenden Locks · **keine** Dateizugriffe · **keine** UI-Abhängigkeiten · **keine** unkontrollierten Seiteneffekte.

### 8.2 Timing-Budget
Timing stabil · Jitter minimiert · Drift gemessen · Quantisierung konsistent.

### 8.3 Performance-Budget
CPU-Spitzen kontrolliert · Speicherverbrauch nicht unkontrolliert wachsend · mobile Geräte nicht überfordert · Android unter realistischen Lasten stabil.

Budgets sind **technische Kontrollgrenzen**, nicht nur Richtwerte.

---

## 9. Release-Gates

Ein Modul darf erst in einen höheren Reifegrad übergehen, wenn alle Gates erfüllt sind:

- **Gate 1 – Architekturprüfung:** Modulgrenzen sauber · Abhängigkeiten erlaubt · Datenfluss nachvollziehbar.
- **Gate 2 – Funktionalitätsprüfung:** Kernfunktion korrekt · Sonderfälle geprüft · Fehlerrückgaben sinnvoll.
- **Gate 3 – Realtime-/Performance-Prüfung:** Timing stabil · Audio stabil · CPU und Speicher akzeptabel.
- **Gate 4 – Regression:** relevante Altpfade funktionsfähig · Migrationspfade intakt · Import/Export konsistent.
- **Gate 5 – Dokumentation:** Änderungen · Risiken · offene Punkte · Release-Stand dokumentiert.

Erst nach allen Gates gilt ein Modul als freigegeben.

---

## 10. Qualitätsstufen

### 10.1 Partial
erste Funktion vorhanden · nicht vollständig · nicht freigabefähig.
### 10.2 Production Candidate
fachlich weitgehend korrekt · Tests vorhanden · noch mit offenen Risiken.
### 10.3 Production Ready
fachlich vollständig · Tests vorhanden · Architektur sauber · Realtime und Performance akzeptabel · dokumentiert.
### 10.4 Locked
Modul/Architektur bewusst stabilisiert · Änderungen nur mit klarer Begründung.

Diese Begriffe werden konsistent verwendet.

---

## 11. Fehlerbehandlung

Fehler werden nicht verschleiert. Grundsätze: valide Fehlertexte · klare Ursachen · keine stillen Fehlschläge · keine unkontrollierten Abstürze · keine verdeckten Teilverluste. Bei Import/Export: defekte Daten erkannt · fehlerhafte Dateien nicht stillschweigend übernommen · Integritätsverletzungen sichtbar · Fallbacks dokumentiert.

---

## 12. Regression Policy

Jede Änderung wird gegen frühere Funktionalität abgesichert: neue Funktion darf alte nicht unbemerkt beschädigen · bekannte Problemklassen dürfen nicht wiederkehren · historische Entscheidungen werden respektiert · Migrationen dürfen vorhandene Projekte nicht unbrauchbar machen. **Regression ist ein Kernproblem, kein Randthema.**

---

## 13. Dokumentationspflicht vor Freigabe

Vor jeder Freigabe dokumentiert: implementierte Funktion · geprüfte Fachlogik · geprüfte Tests · geprüfte Realtime-Aspekte · bekannte Risiken · offene Fragen · nächste Schritte · Reifegrad. Dokumentation ist Teil der Abnahme.

---

## 14. Review-Pflicht

Jede größere Änderung wird vor Freigabe geprüft aus: Architektur · Realtime · Performance · Datenintegrität · Testabdeckung · UX-Auswirkung · Wartbarkeit · Skalierbarkeit. Zeigt eine Perspektive eine Schwäche, wird sie adressiert oder begründet akzeptiert.

---

## 15. Verbotene Freigabeformen

Nicht erlaubt: Freigabe ohne Test · ohne Dokumentation · mit offener Realtime-Gefährdung · bei erkennbarer Dateninkonsistenz · mit offener Doppelarchitektur · trotz unklarer Migration · trotz nicht dokumentierter Risiken.

---

## 16. Praktische Teststrategie

Bevorzugt: deterministische Tests · reproduzierbare Ausgaben · modulare Testfälle · klar nachvollziehbare Fehlerfälle · geringe UI-Kopplung · direkte Tests der Fachlogik. Bei Realtime-/Audio-Tests: **Messbarkeit vor Bauchgefühl · Stabilität vor Perfektion · Aussagekraft vor Oberflächenwirkung.**

---

## 17. Band-übergreifende Rolle von Band 4

Band 4 ist die letzte Governance-Schicht: Band 1 definiert **wie gearbeitet** wird · Band 2 **was die Plattform ist** · Band 3 **wie entwickelt wird** · Band 4 **wie geprüft und freigegeben wird**. Danach beginnt die modulare Umsetzung mit spezialisierten Arbeitsbändern.

---

## 18. Übergabe an die Modulbänder

Nach diesem Band entstehen **keine weiteren allgemeinen Governance-Bänder**. Die nächsten Schritte sind modulbezogen, z. B.: MASTERPROMPT – VibeCore Sync · Audio Engine · DSP Core · VibeCore Groove · VibeCore Sample Forge · VibeCore FX Mix Lab · VibeCore Voice · VibeCore AI · VibeCore Remix. Diese Arbeitsbänder halten sich an Band 1 bis 4.

---

## 19. Ziel dieses Bands

Band 4 sorgt dafür, dass Entwicklung nicht nur möglich, sondern auch belastbar freigabefähig wird. Es beantwortet: Wann ist etwas wirklich fertig? Wie wird Qualität geprüft? Welche Tests sind verpflichtend? Welche Budgets gelten? Welche Gates sind zu bestehen? Wann darf ein Modul als produktionsreif gelten? Damit ist die Governance-Reihe abgeschlossen.

---

## 20. Abschluss

Mit Band 4 ist das Regelwerk für VibeCoreLiv3 vollständig formalisiert: klare Architektur · klare Entwicklungsregeln · klare Prüfregeln · klare Freigaberegeln. Die Plattform ist bereit für die modulare Umsetzung.