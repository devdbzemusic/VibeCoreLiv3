# VibeCoreLiv3 — Coding & Realtime Rules (Operative Compliance-Referenz)

**Bezug:** MASTERPROMPT BAND 3 · **Zweck:** Operatives Mapping der Band-3-Regeln auf die existierende Codebasis — wo jede Regel heute durchgesetzt wird, welche Werkzeuge sie erzwingen, wo Lücken/Risiken liegen.
**Status:** Verbindlich · **Stand:** 2026-07-31

Dieses Dokument übersetzt Band 3 von der Norm in die Praxis. Es ist das日常工作liche Nachschlagewerk für Reviews und Modul-Arbeitsbänder; es ersetzt nicht die Modul-Masterprompts, sondern gibt ihnen die konkreten Anker.

---

## A. Sprach- & Runtime-Disziplin (Band 3 §4)

| Regel | Durchsetzung in der Codebasis |
|-------|-------------------------------|
| **§4.1 ESM, kein `require()`/CommonJS** | Vite-ESM-Projekt; App-Code ist durchgängig `import`/`.ts`/`.tsx`. `require()` existiert nur in der Node-Sandbox (`exec_tool`), nicht im App-Build. |
| **§4.1 Dynamische Imports sinnvoll** | `scheduler.ts` nutzt `await import("@/lib/store")` lazily; `container.ts::detectAndLoad` nutzt `await import("./projectFormat")` zur Vermeidung zirkulärer statischer Abhängigkeit — beides architektonisch begründet. |
| **§4.2 Typdisziplin** | `.ts`/`.tsx` durchgängig; `interface`-Verträge (`ProjectState`, `Vcl3Manifest`, `Scene`, `Part`, `Step`, `Note`, `ArpConfig`); generische `base44.entities.*`-SDK. `any` nur an SDK-Grenzen, nirgendwo als Vertragskern. |
| **§4.3 Daten ⟂ Verhalten** | Datenmodelle in `model.ts` (pure Typen + `default*`-Factorys); Verhalten in `scheduler.ts`/`engine.ts`/`voiceAllocator.ts`/`sampleForge.ts`/`meterBus.ts`. Persistenz-Logik isoliert in `vcl3/*`. |

---

## B. Realtime-Pfad-Disziplin (Band 3 §5)

| Regel | Durchsetzung |
|-------|--------------|
| **§5.1 Kein UI-Thread-Audio** | Single timebase `AudioContext.currentTime` (`scheduler.ts`); UI setzt nur Parameter/liest Status über `store`-Actions. Look-ahead-Scheduler (`nextTickTime`) entkoppelt Trigger vom UI-Tick. `setPlayhead` schreibt nur eine separate `playheads`-Slice (throttled, ~20 Hz) → UI-Render belastet nicht den Transport. |
| **§5.2 Keine Allokationen im Audiopfad** | Scheduler erzeugt pro Tick keine wachsenden Objekte (fixed `stepDurSec`); `humanize` über seedgesteuerte `mulberry32`-Rng (kein GC-Druck). AudioWorklet-Probe (`timing-probe.worklet.ts`) läuft auf dem Audio-Thread; `granular-processor.worklet.ts` kapselt granularen DSP. |
| **§5.3 Determinismus** | `pattern.seed` + `humanizeRng(seed, partId, tick)` → gleiche Eingabe = gleicher Ablauf. ArpEngine hash-basiert (`hashSeed`). Swing/Micro deterministisch aus Step-Index. Nichtdeterminismus (Rng) **kontrolliert + dokumentiert + gemessen**. |
| **§5.4 Lock-Disziplin** | Keine Mutexe im Audiopfad; Zustandsübergabe via `store` (atomare `set`), `masterClock`-Ereignis-Bus, `triggerPart(partId, when, params)` (Wert-Übergabe, keine Shared-State-Mutation durch Sync→DSP). |

---

## C. Audio- & DSP-Disziplin (Band 3 §6)

| Regel | Durchsetzung |
|-------|--------------|
| **§6.1 DSP modular** | Fachbausteine je Datei: `synthVoice.ts` (Perkussion/Synth), `gravLaceBass.ts` (Bass), `voiceAllocator.ts` (zentrale Voice-Policy), `meterBus.ts` (Metering), `granular.ts`+Worklet, `psychoPresets.ts`, `quantumSpatial.ts`. Kein DSP in UI-Komponenten. |
| **§6.2 Echtzeitfähige Parameter** | Parameter via `store`-Actions (`setSynthParam`, `setFxParam`, …); Engine liest zum Trigger-Zeitpunkt. Smoothing/Envelope in DSP-Knoten. Keine Parameterlogik im UI-Renderpfad. |
| **§6.3 Trennung Transport·Scheduler·DSP·Voice·UI** | Transport (`store`) → Scheduler (`scheduler.ts`, `masterClock`) → DSP-Trigger (`triggerPart`) → Voice-Layer (`voiceAllocator`+`synthVoice`/`gravLace`) → UI (nur Spiegel via `playheads`/Meters). ArpEngine emittiert `E_ARP_NOTE`-Events, die den Voice Allocator konsumieren — **kein DSP-Direktzugriff**. |

---

## D. State- & Persistenz-Disziplin (Band 3 §7)

| Regel | Durchsetzung |
|-------|--------------|
| **§7.1 Zustands-Schichten getrennt** | `store`-`partialize` trennt persistierbaren Project-State (`parts/patterns/fx/mod/arp/transport`) vom transienten Session-State (`cpu/voices/peaks/playheads/fps`); Realtime-State (`AudioContext`, Scheduler-Globals) lebt außerhalb des Stores; Diagnostic-State (`audioClockProbe`-Ringbuffer) nicht persistiert. Siehe auch `MODULE_CONTRACTS.md` §E. |
| **§7.2 Versionierbarkeit** | `MIGRATIONS`-Registry + `VCL3_FORMAT_VERSION` in `projectFormat.ts`; Container-`formatVersion`/`containerVersion`/`body.formatVersion` in `container.ts`; Store-`persist.version` mit Migrations-Hook. |
| **§7.3 Single Source of Truth** | `store` ist der einzige Project-State-Kern; `setupStore.ts` ist dokumentierter Session-/Setup-State (keine Shadow-Logik); Engine-Buffer (`buffers` Map) ist Realtime-Spiegel, nicht persistiert. |

---

## E. Naming-Disziplin (Band 3 §8)

Konsequent umgesetzte Fachnamen (Beispiele aus der Codebasis): `transport` · `scheduler` · `masterClock` · `pattern`/`scene`/`part`/`step`/`note` · `voiceAllocator` · `sampleForge` · `gravLaceBass` · `meterBus` · `arpEngine` · `projectFormat` · `containerManifest` (Manifest-Typ) · `parseContainer`/`detectAndLoad` · `patternTimingValidator`. Ein Begriff → ein Name (kein Pattern-vs-Sequencer-Synonym-Chaos).

---

## F. Datei- & Modulschnitt (Band 3 §9)

- **§9.1 Fachlich begrenzte Dateien:** Komponenten ≤ ~50 Zeilen pro Rolle (groovebox-Komponenten je Datei); Services je fachlicher Datei (`arpEngine`, `voiceAllocator`, `meterBus`, …).
- **§9.2 Sammeldateien begründet:** `engine.ts` ist größer — als **dokumentierter Audio-Graph-Integrations-Hub** (Graph-Construction + `triggerPart` + Buffer-Registry), nicht Monolith. `store.ts` bündelt den Zustand (Zustand-Store = legitim). `model.ts` bündelt Daten-Typen (legitime Sammeldatei für das Domain-Modell).
- **§9.3 Keine Schattenkopien:** Legacy `downloadVcl3` (v1-JSON) koexistiert mit `downloadVcl3Container` (v2) — **dokumentiert als v1-Interop-Fallback mit Migrationsplan**, keine stille Parallelimplementierung (beide nutzen `ProjectState`).

---

## G. Refactoring- & Kompatibilitäts-Disziplin (Band 3 §10)

- Bestehendes Funktionieren hat Priorität (z. B. v1→v2-Container bricht das Projekt-Schema nicht: v2 bettet v1 unverändert ein).
- Breaking Changes sind versioniert + migrierbar (`MIGRATIONS`, `formatVersion`-Gate) + dokumentiert (`26_VCL3_Format.md` §11).
- `projectStateFromStore()` wurde als gezieltes Refactor extrahiert und von `serializeProject` + `container.ts` geteilt — **keine** zweite State-Leselogik (§7.3).

---

## H. Testing-Disziplin (Band 3 §11)

| Test-Einstiegspunkt | Deckt |
|---------------------|------|
| `window.runVcl3FormatTests()` | v1-Roundtrip, Versionierung, Fehler-/Integritätsfälle |
| `window.runVcl3ContainerTests()` | v2-Container-Roundtrip, eingebettete Samples, Integritäts-Tamper, Kompressions-Toggle, v1-Erkennung, **Ed25519-Signatur** |
| `window.runAudioTimingTest()` / `runTimingTest` | Audio-Thread-Jitter (AudioContext-Grid), Scheduler-Drift, Late-Events/Xruns |
| `runAudioDiagnostics`, `stressTests`, `mainThreadMonitor` | Performance, CPU, Buffer, Haupt-Thread-Blockierung |

**Grundsatz:** Tests berühren nicht den Audiopfad (pure Analyzer wie `validateFromEvents`); Audio-Worklet-Probe misst **auf dem Audio-Thread**, nicht im UI-Skript-Prozessor (Legacy-SP nur Kontrast). Testcode wird nicht zur Architektur.

---

## I. Dokumentations- & Risikodisziplin (Band 3 §12, §14)

- Jede Datei trägt einen Header-Kommentar mit Fachrolle + Architekturregeln (z. B. `scheduler.ts` „Clock Contract", `container.ts` „Container-Layout", `signing.ts` „Architektur").
- Architektur-Entscheidungen in: `ARCHITECTURE_AUDIT.md`, `MODULE_CONTRACTS.md`, `26_VCL3_Format.md`, `MASTERPROMPT_BAND_{1,2,3}.md`.
- **Benannte Risiken (§14):** (1) `engine.ts`-Größe → Integrations-Hub, monitored; (2) ScriptProcessor-Fallback als Timing-Quelle → dokumentiert als UI-Latenz-Kontrast, `audioJitter` ist die autoritative Metrik; (3) native Oboe-Engine → externer Android-Studio-Build, JNI-Bridge; (4) Mid-Range-Android-Perf → mobile Performance-Overrides in `index.css` deaktivieren Backdrop/Blur/Layered-Glow.

---

## J. Performance-Disziplin (Band 3 §15)

- **Messen statt raten:** `audioPerf.ts` (CPU/Callback-Latenz), `patternTimingValidator.ts` (Grid-Fehler p95/max), `audioClockProbe.ts` (sample-accurate Audio-Zeit).
- **Keine stille Regression:** Timing-Validator klassifiziert `PASS`/`WARN`/`FAIL` mit Schwellen; CPU-Meter im `TopBar`.
- **Realtime-First:** Quality-Profile (`quality.ts`) steuern `lookAheadSec`/`schedulerTickMs`/`scheduleOffsetSec` adaptiv.

---

## K. Verbotene Entwicklungsformen (Band 3 §17) — Audit

| Verbot | Befund |
|--------|--------|
| Ad-hoc-Implementierungen ohne Architekturbezug | Jede Datei gehört zu einem der neun Kernmodule (`MODULE_CONTRACTS.md` §A). ✓ |
| Unkontrollierte Umbauten | Refactors sind gezielt + begründet (z. B. `projectStateFromStore`). ✓ |
| Versteckte Rückkanäle | Rückkanäle nur Metering/Diagnostics/State-Reflection (`scheduler.ts::publishPlayheads`). ✓ |
| Globale Zustandsmischung | `store` als Single-Source; `setupStore` dokumentierter Session-State. ✓ |
| UI-getriebene Audiologik | UI setzt nur Parameter; Timing ausschließlich via Scheduler. ✓ |
| Timing per Zufall | Rng seedgesteuert (`mulberry32`+`hashSeed`) → deterministisch. ✓ |
| Redundante Datenmodelle | v1/v2 teilen `ProjectState`; kein zweites Projektmodell. ✓ |
| Unversionierte Persistenz | `formatVersion`/`containerVersion`/`MIGRATIONS`/Store-`persist.version`. ✓ |
| Nicht dokumentierte Breaking Changes | v1→v2 ist nicht-breaking (v2 bettet v1 ein); Breaks werden versioniert + dokumentiert. ✓ |

---

## L. Lücken / offene Disziplin-Themen

1. **Voice-Modul (Band 2 §8.7):** nicht realisiert → eigenes Modul-Arbeitsband; `SpatialTab`/`BrainwaveTab` sind DSP-R&D, **kein** Voice-Modul (Band 3 §16 fachliche Heimat).
2. **Remix-Modul (Band 2 §8.9):** Container-Slot reserviert → eigenes Arbeitsband.
3. **Native Oboe-Engine:** externer Build (Android Studio/JNI) → nicht im Vite-Stack; `AudioBackend`-Interface entkoppelt (Band 2 §5.2).
4. **Band 4 (QA/Tests/Release-Gates):** nächste Formalisierung — Testhierarchie, Realtime-Benchmarks, Import-/Export-Validierung, Android-Performance-Gates, Release-Kriterien.

---

*Band 3 ist damit von der Norm in die operative Codebasis übersetzt. Modul-Arbeitsbänder müssen diese Anker anwenden und dürfen sie nicht relativieren (Band 3 §18).*