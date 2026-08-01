# Band VI — Quality Constitution

**VibeCore Univers · SUPREMÉ MASTERPROMPT**

---

## Qualitätsphilosophie

> Qualität ist kein Nachbearbeitungsschritt.  
> Qualität ist in jede Entscheidung eingebaut.

Ein Feature, das qualitativ unzureichend ist, ist kein Feature — es ist technische Schuld.

---

## Definition of Ready (DoR)

Ein Task startet erst, wenn **alle** Punkte erfüllt sind:

| # | Kriterium | Anforderung |
|---|-----------|-------------|
| 1 | Ziel | Eindeutig definiert |
| 2 | Module | Betroffene Module bekannt |
| 3 | Akzeptanzkriterien | Liegen schriftlich vor |
| 4 | Architekturfragen | Keine kritischen offen |
| 5 | Abhängigkeiten | Alle Blocker resolved |
| 6 | Important Rule | Verbesserung gegen wichtigste Regel nachgewiesen |

---

## Definition of Done (DoD)

Ein Feature gilt erst als **abgeschlossen**, wenn **alle 10** Kriterien erfüllt sind:

| # | Kriterium |
|---|-----------|
| 1 | Vollständig implementiert |
| 2 | Build erfolgreich (keine Warnings als Errors) |
| 3 | Alle relevanten Tests bestanden |
| 4 | Keine bekannten Blocker offen |
| 5 | Im UI vollständig und korrekt nutzbar |
| 6 | Workflow mindestens gleich gut oder besser |
| 7 | Performance unverändert oder verbessert |
| 8 | Audioqualität unverändert oder verbessert |
| 9 | Code vollständig dokumentiert |
| 10 | Alle Review-Stufen erfolgreich abgeschlossen |

---

## Release Gates

Kein Release ohne vollständiges Gate-Passing.

### Workflow-First Gate ✅

| Frage | Anforderung |
|-------|-------------|
| Ist sie musikalisch sinnvoll? | Ja |
| Spart sie Arbeitsschritte? | Ja |
| Ist sie intuitiv? | Ja |
| Ist sie ohne Erklärung verständlich? | Ja |
| Erhöht sie den kreativen Flow? | Ja |

### Simplicity Gate ✂️

> Komplexität gehört ausschließlich ins System — nicht in die UI.

Jeder Screen hat genau einen klaren Zweck.

### Instant Music Gate ⚡

Alle folgenden Aktionen müssen ≤ 5 Sekunden nach Start erreichbar sein:
- Drum-Groove erstellen
- Bass spielen
- Pattern aufnehmen
- Effekte verändern
- Performance starten

### Performance Gate 🚀

| Metrik | Anforderung |
|--------|-------------|
| Audio-Latenz | < 10 ms |
| CPU | Kein sustained > 80% |
| RAM | Kein unkontrolliertes Wachstum |
| UI | 60 FPS |
| Audio-Dropouts | Keine |
| Mobile | Qualifiziert auf Snapdragon 7xx+ |

### Audio Quality Gate 🎚️

Folgendes darf unter keinen Umständen auftreten:

| Problem | Status |
|---------|--------|
| Clipping | Verboten |
| Phasenfehler | Verboten |
| Timingfehler | Verboten |
| Instabile Synchronisation | Verboten |
| Unkontrollierte Pegelsprünge | Verboten |
| DC-Offset | Verboten |

### Tomorrow Sound Gate 🔊

| Frage | Anforderung |
|-------|-------------|
| Erzeugt sie neue musikalische Möglichkeiten? | Ja |
| Erweitert sie den kreativen Ausdruck? | Ja |
| Unterstützt sie den VibeCore-Charakter? | Ja |
| Differenziert sie von bestehenden DAWs? | Ja |

---

## Architektur-Review

Nach jedem abgeschlossenen Feature automatisch:

| Review | Prüft |
|--------|-------|
| Architektur | Schichten-Integrität · Modul-Grenzen · API-Konsistenz |
| Audio | Signalfluss · Routing-Korrektheit · Pegelbalance |
| DSP | Realtime Safety · Determinismus · Speicher-Nutzung |
| Workflow | One Touch · 5-Sec-Rule · Hardware Feeling |
| UI | Konsistenz · Touch-Targets · Accessibility |
| AI | Vorschlag-Qualität · Privacy · Optionalität |
| Performance | FPS · CPU · XRuns · Latenz |
| QA | Test-Abdeckung · Regressions · Edge Cases |

Alle festgestellten Mängel werden **vor Abschluss** behoben.

---

## DSP-Review

Spezifische Prüfpunkte für jeden DSP-Node:

| Punkt | Beschreibung |
|-------|-------------|
| Realtime Safety | Keine Allokationen, keine Locks im Audio-Thread |
| Determinismus | Gleicher Input → gleicher Output (immer) |
| Latenz-Kompensation | Dokumentierte Plugin-Latenz |
| Übergangsverhalten | Keine Knackser bei Parameter-Änderungen |
| Bypass | Vollständig transparent (Phase + Pegel) |
| Overflow | Kein numerischer Überlauf unter Last |
| Underrun | Graceful Degradation bei Buffer-Underrun |

---

## Android-Review

| Punkt | Anforderung |
|-------|-------------|
| Min SDK | API 21 (Android 5.0) |
| Target SDK | Aktuell -1 |
| AAudio | Bevorzugt ab API 27 |
| OpenSL ES | Fallback für < API 27 |
| ADPF | Performance Hints ab API 31 |
| Big-Core | CPU-Affinität konfigurierbar |
| Memory | Keine Memory-Leaks (LeakSanitizer) |
| Threading | ThreadSanitizer clean |

---

## Performance Gates

### Minimum akzeptable Performance

| Gerät | Mindest-Anforderung |
|-------|---------------------|
| Snapdragon 7xx | 60 FPS · < 10 ms Latenz |
| Snapdragon 8xx | 60 FPS · < 6 ms Latenz |
| Low-end (Snapdragon 4xx) | 30 FPS · < 20 ms Latenz (mit AUTO Quality) |

### Adaptive Quality

| Profil | Aktivierung | Verhalten |
|--------|-------------|-----------|
| AUTO | Standard | Passt sich FPS+Voice-Load an |
| HIGH | Manuell | Maximale DSP-Qualität |
| MEDIUM | AUTO oder Manuell | Reduziertes Oversampling |
| LOW | AUTO oder Manuell | Minimale DSP-Kette |

---

## Regression

| Regel | Beschreibung |
|-------|-------------|
| Kein Test wird gelöscht | Tests werden deprecated, niemals entfernt |
| CI auf jedem Commit | Alle Tests müssen grün sein |
| Performance-Regression | Latenz +10% → Build schlägt fehl |
| Audio-Regression | Referenz-Test-Aufnahme-Vergleich |

---

## Security

| Aspekt | Anforderung |
|--------|-------------|
| Keine Credentials im Code | Secrets nur in Environment |
| Audio-Berechtigungen | Nur wenn unbedingt nötig |
| Datei-Zugriff | Scoped Storage (Android) |
| Netzwerk | Nur für explizite Sync-Features |
| KI-Profil | Lokal, nicht automatisch hochgeladen |
| Binaural | Safety Limits fest verdrahtet |

---

## Dokumentation

| Was | Anforderung |
|-----|-------------|
| Jede öffentliche API | Vollständig dokumentiert |
| Jeder DSP-Node | Latenz + Parameterliste dokumentiert |
| Architektur-Entscheidungen | ADR (Architecture Decision Record) |
| Nicht-offensichtlicher Code | Inline-Kommentar |
| Module | README mit Zweck + Schnittstellen |

### Verbotene Kommentare

- `// TODO: Fix later`
- `// Hack`
- `// Don't touch this`
- `// Magic number`

→ Diese müssen durch ordentliche Dokumentation oder Refactoring ersetzt werden.

---

## Sprint-Regeln

| Regel | Beschreibung |
|-------|-------------|
| Keine neuen Anforderungen | Während laufenden Features |
| Neue Ideen | Dokumentiert → nächster Sprint |
| Feature Freeze | 24 Stunden vor Review |
| Rollback-Plan | Für jedes kritische Feature vorhanden |

---

*Band VI — Quality Constitution · VibeCore Univers SUPREMÉ MASTERPROMPT*
