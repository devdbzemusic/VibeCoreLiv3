# 00 — Vision

> Phase/Doc 00 · Status: Draft v1.0 · Owner: Senior Audio Director + Senior Product Visionary · Review: 15-Rollen, 2/3-Mehrheit

## 1. Produktvision
VibeCoreLiv3 ist eine **bahnbrechende, noch nicht existierende Audio-Software**: eine modulare Plattform, deren kreative Kraft aus **Timing** entsteht — „Emotion durch Timing". Nicht die Menge an Effekten, sondern die Präzision und Menschlichkeit des Grooves definieren den Klang. Die Plattform verbindet Studio-Kontrolle mit Performance-Spielbarkeit und lässt Drittentwickler über ein offenes SDK eigene Module hinzufügen, ohne die deterministische Echtzeit-Garantie zu verletzen.

## 2. Kreative Leitlinie
- **Emotion durch Timing** — Groove, Swing, Humanize und Polyrhythmik sind一等 citizens, nicht Add-ons.
- **Determinismus als Vertrauen** — was klingt, ist reproduzierbar; nichts zufällig außer der Künstler will es.
- **Studio trifft Bühne** — jede Session ist live spielbar (Scene-Switching ohne Dropout).
- **Offenheit ohne Kompromisse** — SDK-Module genießen dieselben Echtzeit-Garantien wie der Kern.

## 3. Zielgruppe
1. **Producer/Sound-Designer** — die Timing-basierte Kreativität über Effekt-Masse stellen.
2. **Live-Performer** — die groove-getriebene, dropout-freie Performance benötigen.
3. **Modul-Entwickler** — die eine stabile, deterministische Audio-Plattform als Basis suchen.
4. **Remix-Künstler** — die nicht-destruktive Stem-/Clip-Workflows brauchen.

## 4. Alleinstellungsmerkmale (USP)
- Zentrale Sync-Engine als einzige Zeitbasis — Polyrhythmik & Polymetrik nativ.
- Deterministische, lock-free Audio-Architektur mit nachweisbarem CPU-Budget.
- Groove-Engine (Phase 6) als musikalischer Performance-Core, früh verfügbar.
- Open SDK mit Realtime-Validator — Drittmodule werden *bewiesen* sicher.

## 5. Sound-Design-Handbuch (Preset-Erstellung)
Verbindlich für alle mitgelieferten Presets (Owner: Senior Audio Director):
- **Identität:** jedes Preset hat eine musikalische Absicht (z.B. „808-Sub, der atmet").
- **Timing-Parameter:** Groove/Swing/Velocity-Layer dokumentiert, nicht nur Klangfarbe.
- **Layering:** Synth + Sample sind first-class kombinierbar (siehe `10_Synth.md`, `11_Sample_Forge.md`).
- **Versionierung:** Presets folgen `schemas/preset.schema.json` und einer Semantic-Version.
- **Workflow:** Aufnehmen → Bearbeiten → Verwenden → Speichern (siehe `11_Sample_Forge.md`).

## 6. Erfolgsmaßstäbe
- Jitter < 0,1 ms @ 48 kHz in der Sync-Engine.
- Live-Scene-Switch ohne hörbaren Dropout bei voller Stimmenlast.
- ≥ 2 funktionsfähige SDK-Beispiel-Module in Phase 5.
- CPU-Budget pro Modul einhaltbar auf Referenz-Hardware (Definitiv in `15_Performance.md`).

## 7. Abgrenzung
- Keine klassische DAW-Spur-Automation als Ersatz für Modulation — Modulation ist ein DSP-Graph-Bürger.
- Kein Cloud-Zwang — Offline-Fähigkeit ist Grundrecht; Cloud ist optionales Innovations-Backlog.