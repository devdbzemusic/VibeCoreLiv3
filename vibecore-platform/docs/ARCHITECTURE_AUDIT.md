# VibeCoreLiv3 — Architecture Audit (Band 1 · Kartierung)

> Verbindliche Modul-Kartierung der vorhandenen Code-Basis gegen die neun
> Kernsysteme des Masterprompt-Band-1. Grundlage ist der tatsächlich
> vorhandene Projektstand (nicht die Theorie). Erstellt vom 15-Spezialisten-Board
> als Grundlage aller nachfolgenden Implementierungsentscheidungen.

**Datum:** 2026-07-31 · **Audit-Revision:** 1 · **Store-Version:** 12 (Pattern-Domain)

---

## 1. Status-Snapshot

| Kernsystem | Reifegrad | Primär-Code | Status |
|---|---|---|---|
| VibeCore Sync | Produktion | `src/lib/clock/*`, `src/lib/sync/adaptiveSync.ts`, `scheduler.ts` | ✅ Stabil |
| VibeCore Groove | Produktion | `scheduler.ts`, `SeqTab`, `PianoRollTab`, `RollDrumLane`, `arpEngine.ts`, `groovePresets.ts` | ✅ Stabil |
| VibeCore 3D Synth | Produktion | `synthVoice.ts` (Kick/Snare/Hat/Synth), `modulation.ts`, `quantumSpatial.ts` | ✅ Stabil |
| VibeCore 3D Bass | Produktion | `gravLaceBass.ts` (GravLace: Lace/Gate/Warper), `synthVoice.ts` Bass-Case | ✅ Stabil |
| VibeCore FX Mix Lab | Produktion | `engine.ts` (6 FX-Busse, Kanalstrip, Master M/S-Width, Limiter), `FxTab`, `MixTab`, `ChannelStrip`, `meterBus.ts` | ✅ Stabil |
| VibeCore Sample Forge | Produktion | `sampleForge.ts`, `sampleLibrary.ts`, `forge/` (Node-Graph), `granular.ts`, `prodRender.ts`, `SmplTab`, `ForgeTab`, `LibTab` | ✅ Stabil |
| VibeCore Voice | Teilweise | `engine.ts` FX-Typ „Voice Mod" (3 Bandpass-Formanten) | ⚠️ Nur FX-Bus, kein eigenständiges Modul |
| VibeCore AI | Produktion | `aiSceneBuild.ts` (deterministisch: `buildGroove`/`buildMelody`), `AiCoAssistant`, `AiSceneTab` | ✅ Stabil (deterministisch, kein LLM-Netzaufruf) |
| VibeCore Remix | Fehlend | — | ❌ Kein Stem-/Clip-/Remix-Modul vorhanden |

**Querverweis:** Native Android-Oboe-Engine (`native-android/`) und C++-Plattform-Backbone (`vibecore-platform/`) als separate Build-Strecken — nicht Teil des Vite/Web-Stacks.

---

## 2. Architektur-Prinzipien — Konformitätsprüfung

### 2.1 VibeCore Sync = einzige Zeitbasis ✅
- `scheduler.ts` nutzt ausschließlich `AudioContext.currentTime` als Tick-Quelle (`nextTickTime`, `globalTick`).
- `setInterval` weckt nur den Scheduler; der Beat-Grid wird durch Audio-Context-Zeitstempel getrieben.
- `masterClock` ist die einzige Transport-Phase-Autorität; externe Quellen halten ihre eigene Phase, interne Quelle wird beim Transport-Start auf Bar 0 gesperrt.
- **Keine konkurrierende Clock gefunden.** Keine versteckte lokale Zeitbasis in DSP-Modulen (`synthVoice`, `gravLaceBass`, `granular` beziehen alle `when` vom Scheduler).

### 2.2 DSP strikt vom UI getrennt ✅
- Alle DSP-Module (`synthVoice`, `gravLaceBass`, `granular`, `sampleForge`, FX-Busse in `engine.ts`) operieren ausschließlich auf `AudioContext`-Knoten und dem vom Scheduler übergebenen `when` — keine React/Renderer-Abhängigkeit.
- Meter-Bus (`meterBus.ts`) ist non-React; Zustand wird nicht aus der Meter-Schleife geschrieben (10 Hz, Audio-Frame-orientiert).
- `applyAllParams` ist dirty-geblockt (nur bei Audio-relevantem Slice-Wechsel), nicht feuerschlauch-gebunden.
- `PianoRollTab` nutzt granulare Selektoren; `RollPlayhead` ist isolierter Subscriber — keine Voll-Rerenders pro Tick.

### 2.3 Module statt Monolith ✅
- Klare Datei-Trennung pro Fachmodul; Shared-State nur über `useGroove`-Store und `meterBus`/`masterClock`.
- Zentraler `voiceAllocator` als einzige Stimmen-Budget-Quelle über alle Module (Priorität-Tier: CRITICAL→LOW).

### 2.4 Native Audio zuerst ✅ (Web-Pfad)
- Web-Audio-Pfad nativ auf `AudioContext`; `AudioWorklet` für Granular (`granular-processor.worklet.ts`) und Timing-Probe (`audioClockProbe`).
- Android-Pfad: Oboe/AAudio/C++/JNI (`native-android/`) — kein Java-Audio im primären Pfad; Bridge über `window.VibeCoreNative`.

### 2.5 Keine Doppelarchitektur ✅
- Eine Engine (`engine.ts`), ein Scheduler (`scheduler.ts`), ein Stimmen-Allokator (`voiceAllocator`), ein Master-Clock.
- `AudioBackend`-Interface ist swappable, aber nur zwei Implementierungen (Web `engine.ts`-Pfad / nativ Oboe) — keine parallelen DSP-Engines.

---

## 3. Technische Schulden (Register)

| ID | Schuldenpunkt | Modul | Risiko | Priorität |
|---|---|---|---|---|
| D-01 | `playheads` werden mit 20 Hz in Zustand geschrieben (`publishPlayheads`, `PLAYHEAD_WRITE_MS=50`) | Sync/Groove | UI-Rerender konkurriert mit Audio-Thread auf Mid-Range-Android | Niedrig (Playhead ist legitimes UI-Signal; PianoRoll bereits entkoppelt) |
| D-02 | Timing-Validator `observedJitter` (ScriptProcessor-Fallback) spiegelt Main-Thread-Latenz wider | Sync/QA | Diagnostik-Missverständnis | Bereits per `audioJitter` (wahr) + Kommentar gelöst; Doku konsolidieren |
| D-03 | Native Oboe-Engine erfordert externen Android-Studio-Build + JNI-Konfiguration | Native | Web-Stack kann native Leistung nicht validieren | Nicht im Web-Stack lösbar |
| D-04 | C++-Plattform-Backbone (`vibecore-platform/`) Phase-1-Implementierung offen (ROADMAP) | Native/Platform | Keine Auswirkung auf Web-App | Externe Strecke |
| D-05 | Kein serialisierbares Projekt-Dateiformat (`.vcl3`); Persistenz nur via `localStorage` (Zustand persist v12) | Project Format | Blockiert Export/Import, Remix (Stems), Projekt-Sharing | **Hoch** |
| D-06 | VibeCore Voice nur als Formant-FX-Bus vorhanden; kein eigenständiges Vocal-Modul | Voice | Modul 9.7 unvollständig | Mittel |
| D-07 | VibeCore Remix vollständig fehlt | Remix | Modul 9.9 nicht vorhanden | Mittel (§10-Priorität #11) |
| D-08 | Kein Plugin-/Modul-Lade-Interface (nur `AudioBackend`-Swap) | Plugin | Erweiterbarkeit begrenzt | Niedrig (§10-Priorität #10) |

---

## 4. Höchste Priorität (gemäß §10 Prioritätslogik)

Die Prioritäten #1–3 (Audio-Engine-Stabilität, DSP-Core-Korrektheit, VibeCore-Sync-Zeitbasis) sind im aktuellen Stand **reif und stabil** — im Review wurden keine kritischen offenen Bugs identifiziert:

- Single-Timebase korrekt durchgesetzt (`AudioContext.currentTime`).
- Voice-Allokator + Stealing-Policy aktiv; Click-Prävention (1 ms Attack-Rampen, Non-Loop-One-Shot-Volldezy, `assignBufferToPart`-Crossfade).
- Lookahead-Scheduler mit `baseLatency + outputLatency`-Kompensation und Transport-Phase-Locking.
- Meter/UI entkoppelt (non-React `meterBus`, 10 Hz, Audio-Frame-orientiert).

Die erste **handlungsbedürftige Lücke** in der Prioritätsreihenfolge ist **#8 — Projektformat `.vcl3`** (Schuld D-05), denn:

1. Sie ist Voraussetzung für **#9 Export-System** (Projekt-/Stem-Export) und **#11 Remix** (Stem-Workflows brauchen serialisierbare Projekt-/Stem-Daten).
2. Sie schließt die einzige Persistenz-Lücke (aktuell nur `localStorage`, kein Datei-Import/Export, kein Versions-/Backup-Pfad).
3. Sie ist ohne Eingriff in den laufenden Audio-Pfad realisierbar (rein auf Store-/Serialisierungs-Ebene) — **Realtime-Sicherheit nicht gefährdet**.

**→ Nächster Arbeitsschritt (Band 1 §17 Schritt 4):** Implementierung des serialisierbaren `.vcl3`-Projektformats (Schema + Serialisierer vom `useGroove`-Store + Import/Export-Wiring), ohne bestehende Audio-Logik zu verändern.

---

## 5. Board-Stellungnahmen (Kurz)

- **Audio Engine Architect:** Core stabil; kein Eingriff in `engine.ts`/`triggerPart` nötig.
- **DSP Core Architect:** GravLace + Synth-Stimmen korrekt; `voiceAllocator` als zentrale Budget-Quelle verhindert Über-Allokation.
- **Sequencer Architect:** Scheduler deterministisch, Lookahead + Latency-Kompensation korrekt.
- **Project Format Architect:** `.vcl3` fehlt — höchste handlungsbedürftige Lücke; Store v12 ist serialisierbar, aber kein Dateiformat definiert.
- **Realtime QA Architect:** Timing-Validator trennt Audio-Thread-Jitter korrekt; `observedJitter` ist Legacy-Kontrast, nicht Primärmetrik.
- **Systems Architect:** Modulgrenzen sauber; keine Doppelarchitektur; `AudioBackend`-Swap ist die einzige legitime Dual-Implementierung.
- **Product & Release Architect:** Ohne `.vcl3` kein Projekt-Sharing/Backup/Versionierung → Release-Blocker für ernsthafte Nutzung.

---

## 6. Entscheidungsprotokoll

| Entscheidung | Begründung | Risiko |
|---|---|---|
| Audio-Core (Sync/Groove/Synth/Bass/FX/Sample) nicht anfassen | Reif; Eingriff würde Realtime-Stabilität ohne Not riskieren | Kein |
| `.vcl3` als nächste Implementierung | Höchste handlungsbedürftige Lücke; Voraussetzung für Export + Remix; realtime-neutral | Serialisierungs-Migration (Store v12 → Datei), muss rückkompatibel bleiben |
| Remix-/Voice-Module erst nach `.vcl3` | Brauchen serialisierbare Projekt-/Stem-Daten bzw. FX-Bus-Erweiterung | Modul 9.7/9.9 bleiben unvollständig bis dahin |

*Ende Audit-Revision 1.*