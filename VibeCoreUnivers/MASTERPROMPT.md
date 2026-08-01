# VibeCore Univers — SUPREMÉ MASTERPROMPT

**Die oberste Verfassung des gesamten VibeCore-Projekts**

---

## OBERSTES FUNDAMENT — CREATIVE WORKFLOW CONSTITUTION

→ **[CREATIVE_WORKFLOW_CONSTITUTION.md](CREATIVE_WORKFLOW_CONSTITUTION.md)**

> **SUPREMÉ DIRECTIVE 001: Workflow is Law.**  
> Die Implementierung wird aus der Benutzerführung abgeleitet — niemals umgekehrt.  
> Kein Feature-Design ohne Phase-Zuordnung und Freigabe durch den Creative Master Workflow Senior SUPREMÉ Manager.

Der Creative Flow folgt 11 Phasen:  
`IDEE → GROOVE → BASS → HARMONIE → MELODIE → SOUND DESIGN → FX → LIVE PERFORMANCE → REMIX → ARRANGEMENT → EXPORT`

Alle Bände, alle Architekturentscheidungen, alle UI-Designs ordnen sich diesem Weg unter.

---

## SUPREMÉ EXECUTIVE RULE — WORKFLOW FIRST POLICY

> **Der Workflow ist das Produkt.**

Audioqualität, DSP und Performance sind entscheidend — aber sie entfalten ihren Wert nur, wenn der Musiker sie intuitiv und ohne Unterbrechung nutzen kann.

### Phase 1 — UX & Workflow (muss 100 % abgeschlossen sein)

**Keine Audiooptimierung. Keine Performanceoptimierung. Keine Testkampagnen.**  
Zuerst wird ausschließlich der Workflow perfektioniert.

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

DSP, Oboe, Audio-Engine und Tests sind bis zum Abschluss des Workflow-Gates **nachrangig**.

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
7. Lass die Architektur vom Executive Board freigeben.

**Erst danach darf Code implementiert werden.**

Das Executive Board bewertet vor jeder Implementierung ausschließlich:  
One Touch · Five Second Rule · Hardware Feeling · Live Performance · Konsistenz · Ergonomie · Lernbarkeit · Modularität · Sichtbarkeit der Funktionen · Kreativer Flow

Kein Feature wird implementiert, bevor der Workflow den Status **„WORKFLOW APPROVED"** erhalten hat.  
Keine Tests werden durchgeführt, bevor die UI- und Workflow-Architektur freigegeben wurde.

---

## Die wichtigste Regel

> Jede Architekturentscheidung muss nachweislich mindestens eines dieser Ziele verbessern:
>
> **Kreativität · Workflow · Klangqualität · Echtzeitfähigkeit · Stabilität · Erweiterbarkeit · Wartbarkeit · Benutzererlebnis**
>
> Wenn keine Verbesserung nachgewiesen werden kann, wird die Entscheidung nicht umgesetzt.

Diese Regel ist **unveränderbar** und steht über allen anderen Dokumenten.

---

## Executive Vision

> VibeCore Univers ist kein Musikprogramm.  
> Es ist ein **modulares kreatives Universum** für elektronische Musikproduktion und Live-Performance.

Jede Komponente dient einem Ziel:

> Den kreativen Fluss des Musikers zu beschleunigen, ohne technische Komplexität sichtbar zu machen.

---

## Dokumentstruktur

Dieses Regelwerk ist in 7 Bände gegliedert.  
Jeder Band ist ein eigenständiges, versionierbares Dokument.

| Band | Titel | Pfad |
|------|-------|------|
| I | Executive Constitution | [SUPREME/01_Executive_Constitution.md](SUPREME/01_Executive_Constitution.md) |
| II | Platform Constitution | [SUPREME/02_Platform_Constitution.md](SUPREME/02_Platform_Constitution.md) |
| III | Creative Universe | [SUPREME/03_Creative_Universe.md](SUPREME/03_Creative_Universe.md) |
| IV | AI Constitution | [SUPREME/04_AI_Constitution.md](SUPREME/04_AI_Constitution.md) |
| V | UX Constitution | [SUPREME/05_UX_Constitution.md](SUPREME/05_UX_Constitution.md) |
| VI | Quality Constitution | [SUPREME/06_Quality_Constitution.md](SUPREME/06_Quality_Constitution.md) |
| VII | Future Constitution | [SUPREME/07_Future_Constitution.md](SUPREME/07_Future_Constitution.md) |

→ **[Vollständiger Index](SUPREME/INDEX.md)**

---

## Verhältnis zu bestehenden Dokumenten

Dieses Werk **baut auf** den bestehenden Grundprinzipien auf und **ersetzt sie nicht**:

| Dokument | Verhältnis |
|----------|-----------|
| `../MASTERPROMPT.md` (v5.0) | Workflow-Details und DoR/DoD — weiterhin gültig |
| `../NATIVE_AUDIO_PLATFORM.md` | Implementierungs-MASTERPROMPTs 1–10 — weiterhin gültig |
| `../FX_MIXLAB_SUPREME.md` | FX MIX LAB Detail-Spec — weiterhin gültig |
| `../AI_ARP_INTELLIGENCE.md` | ARP Executive Board Spec — weiterhin gültig |

Die Bände dieses Werks sind die **Verfassung**.  
Die spezifischen Dokumente sind die **Gesetze**.  
Die Verfassung hat Vorrang bei Widersprüchen.

---

## Schnell-Referenz: Kritische Invarianten

### Platform
- ONE Oboe Engine · ONE VibeCore Sync · Zero Allocations im Audio-Thread
- Audio Callback: ausschließlich Mix + DSP + Output

### Navigation
- 9 Module (+ HOME) im Bottom Nav
- Max. 2 Nav-Ebenen
- REMIX ist Sub-Tab von FX MIX LAB — kein eigenes Modul

### AI
- KI verarbeitet kein Audio
- KI besitzt keine eigene Clock
- Alle Vorschläge: optional + editierbar + transparent

### UX
- One Touch · Five Second Rule · Hardware Feeling
- Ein Regler = Eine Funktion · Kein Feature an zwei Orten

### Quality
- DoR: Task startet erst wenn bereit
- DoD: 10 Kriterien alle erfüllt
- 6 Gates: alle müssen PASS sein

---

## SUPREMÉ APPROVED Gate

> Nur wenn alle Fragen mit **Ja** beantwortet werden können:  
> **SUPREMÉ APPROVED – GO FOR IMPLEMENTATION.**

| Frage |
|-------|
| Verbessert diese Funktion den kreativen Workflow? |
| Ist sie deterministisch und echtzeitfähig? |
| Ist sie mit der Plattformarchitektur kompatibel? |
| Erhöht sie die Performance oder zumindest nicht deren Kosten? |
| Ist sie langfristig wartbar und modular erweiterbar? |
| Unterstützt sie die Vision einer professionellen mobilen Live-Performance-Groovebox? |
| Kann die Verbesserung gegen die wichtigste Regel nachgewiesen werden? |

---

*VibeCore Univers — SUPREMÉ MASTERPROMPT · Oberste Verfassung*  
*Dieses Dokument ist verbindlich für alle Architektur-, UX-, DSP-, AI- und Qualitätsentscheidungen.*
