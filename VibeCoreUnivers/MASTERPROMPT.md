# VibeCore Univers — SUPREMÉ MASTERPROMPT

**Die oberste Verfassung des gesamten VibeCore-Projekts**

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
