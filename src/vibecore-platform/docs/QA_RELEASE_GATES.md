# VibeCoreLiv3 — QA, Release Gates & Definition of Done (Operative Referenz)

**Bezug:** MASTERPROMPT BAND 4 · **Zweck:** Operatives Mapping der QA-/Release-Regeln auf die existierende Codebasis — Testhierarchie → konkrete Einstiegspunkte, Pflichttests je Änderungsart, Realtime-/Performance-Budgets mit bereits gesetzten Schwellen, Release-Gates, Modul-Reifegrade, DoD-Checkliste.
**Status:** Verbindlich · **Stand:** 2026-07-31

Dieses Dokument macht Band 4 messbar: es verknüpft jede Prüf-/Gate-/Budget-Regel mit dem tatsächlichen Werkzeug, das sie heute erzwingt, und weist jedem der neun Kernmodule seinen aktuellen Reifegrad (§10) zu. Es ist das Freigabe-Handbuch für alle späteren Modul-Arbeitsbänder.

---

## A. Testhierarchie → konkrete Einstiegspunkte (Band 4 §4)

| Ebene | Werkzeug / Einstiegspunkt | Prüft |
|-------|---------------------------|------|
| **§4.1 Architektur/Verträge** | `MODULE_CONTRACTS.md` (Modul-Registry + Dep-Audit) · `CODING_REALTIME_RULES.md` §K (verbotene Formen) | Modulgrenzen, erlaubte Deps, API-Verträge, Persistenz-/Formatregeln |
| **§4.2 Fachliche Funktion** | `window.runVcl3FormatTests()` (v1) · `window.runVcl3ContainerTests()` (v2 + Ed25519) | Projektfunktion, Datenfluss, Import-/Export-Zustände |
| **§4.3 Realtime/Timing** | `window.runAudioTimingTest()` / `runTimingTest` (`patternTimingValidator.ts`) · `clockTest.ts` · `latencyTest.ts` | Scheduler-Grid, Clock, Transport, Drift, Jitter, Stabilität unter Last |
| **§4.4 Performance** | `runAudioDiagnostics` · `audioPerf.ts` · `stressTests.ts` · `mainThreadMonitor.ts` · `TopBar`-CPU-Meter | CPU, Speicher, Latenz, Xruns, Renderzeit, Skalierung |
| **§4.5 Integration/System** | Container-Roundtrip (`runVcl3ContainerTests`) · Audio-Engine-End-to-End via `scheduler`+`triggerPart` · native Oboe-Bridge (extern) | Modulinteraktion, Persistenz, Import/Export, Android-Native |
| **§4.6 Regression** | Selbsttests + `MIGRATIONS`-Registry-Tests in `runVcl3FormatTests`/`runVcl3ContainerTests` | alte Funktionen, bekannte Fehler, Versionierung/Migration |

**Realisierte Ausführung:** alle Browser-Tests über `window.run*` (konsolentauglich, deterministisch, UI-entkoppelt); Audio-Thread-Messung über AudioWorklet-Probe (`timing-probe.worklet.ts`), nicht über ScriptProcessor (Legacy-SP nur Kontrastmetrik).

---

## B. Pflichttests je Änderungsart (Band 4 §7) → Matrix

| Änderungsart | Pflichttests (Band 4) | Konkretes Werkzeug |
|--------------|----------------------|--------------------|
| **Audio/DSP** | Timing · Audio-Stabilität · Last · Latenz/Jitter · Realtime-Sicherheit | `runAudioTimingTest`, `stressTests`, `audioPerf`, `mainThreadMonitor` |
| **Sync/Transport** | Clock · Transport · Quantisierung · Pattern-/Scene-Wechsel · Langzeitstabilität | `clockTest`, `latencyTest`, `runAudioTimingTest` (Langzeit über `durationSec`) |
| **Persistenz/Format/Container** | Roundtrip · Version/Migration · Fehlerfall · Integrität · Kompatibilität | `runVcl3FormatTests` + `runVcl3ContainerTests` (Tamper, v1-Erkennung, Kompressions-Toggle, Ed25519) |
| **UI/Workflow** | Interaktion · Zustandskonsistenz · Reaktionszeit · Seiteneffekte · Store-Kompatibilität | Live-Preview, `store`-Selector-Granularität, `playheads`-Throttle |
| **Android/Native** | Build/Integration · Speicher · CPU/Thread · Latenz · Gerätekompatibilität | `native-android/**` (Oboe/JNI), `AudioBackend`-Interface, externer Android-Studio-Build |

---

## C. Realtime- & Performance-Budgets (Band 4 §8) — gesetzte Schwellen

| Budget | Konkrete Grenze | Durchsetzung |
|--------|-----------------|--------------|
| **§8.1 Realtime-Pfad** | keine Allokationen/Locks/Dateizugriffe/UI-Abhängigkeit im Audiopfad | Look-ahead-Scheduler (`scheduler.ts`), seedgesteuerte Rng, `triggerPart`-Wertübergabe, AudioWorklet-Probe |
| **§8.2 Timing — Grid-Fehler** | **Grid p95 ≤ 1.5 ms · Grid max ≤ 5.0 ms** | `patternTimingValidator.ts::DEFAULT_THRESHOLDS.gridP95Ms/gridMaxMs` |
| **§8.2 Timing — Audio-Jitter** | **Audio-Jitter p95 ≤ 5.0 ms** | `DEFAULT_THRESHOLDS.jitterP95Ms`; Metrik = AudioContext-Grid (nicht SP-Callback) |
| **§8.2 Klassifikation** | `PASS` / `WARN` (≤ 2× Schwellen) / `FAIL` | `validateFromEvents`-Klassifikation |
| **§8.3 Performance — Quality-Profile** | adaptiv `LOW`/`MEDIUM`/`HIGH` (`lookAheadSec`, `schedulerTickMs`, `scheduleOffsetSec`) | `quality.ts` + `onQualityChange`-Re-Arm des Timers |
| **§8.3 Mobile** | Backdrop/Blur/layered-Glow deaktiviert ≤ 768 px / coarse-pointer | `index.css` mobile Performance-Overrides |

Budgets sind **technische Kontrollgrenzen**; eine `FAIL`-Klassifikation blockiert Gate 3.

---

## D. Release-Gates (Band 4 §9) → Verifikationsartefakt

| Gate | Verifikation durch |
|------|-------------------|
| **G1 Architektur** | `MODULE_CONTRACTS.md` §A/§C (Modul-Zuordnung + Dep-Audit) + `CODING_REALTIME_RULES.md` §K |
| **G2 Funktional** | fachliche Selbsttests (`runVcl3*`) + Live-Preview-Verhalten |
| **G3 Realtime/Performance** | `runAudioTimingTest` (≥ `PASS`/`WARN`) + `audioPerf`/`TopBar`-CPU + `stressTests` |
| **G4 Regression** | `runVcl3FormatTests` + `runVcl3ContainerTests` (Migration/Version/Tamper) |
| **G5 Dokumentation** | Datei-Header-Kommentare + `ARCHITECTURE_AUDIT`/`MODULE_CONTRACTS`/`26_VCL3_Format`/`MASTERPROMPT_BAND_{1..4}`/`CODING_REALTIME_RULES` |

**Freigabe erst nach allen 5 Gates.** Fehlendes Gate → Reifegrad bleibt `Partial`/`Production Candidate`.

---

## E. Modul-Reifegrad (Band 4 §10) — aktueller Stand

| Modul | Reifegrad | Begründung |
|-------|-----------|------------|
| VibeCore Sync | **Production Ready** | Single timebase (`AudioContext.currentTime`+`masterClock`), Look-ahead, Drift-/Jitter-Tests, Tap-Tempo, Latency-Kompensation |
| VibeCore Groove | **Production Ready** | deterministischer Sequencer, Probability/Ratchet/Swing/Humanize, Scene-/Pattern-Wechsel deterministisch, Undo/Redo |
| VibeCore 3D Synth | **Production Ready** | zentraler `voiceAllocator` mit Priority-Tiers, Polyphonie/Voice-Stealing, `synthVoice`/`forge` |
| VibeCore 3D Bass | **Production Ready** | GravLace über zentralen Voice-Allocator, deterministisch |
| VibeCore FX Mix Lab | **Production Ready** | Routing-Matrix, Sends/Returns, Metering observe-only, Master stabil |
| VibeCore Sample Forge | **Production Candidate** | eingebettete Samples realisiert; **Streaming großer WAVs = künftig** (Chunking-Roadmap §18 im Format-Spec) |
| VibeCore Voice | **Partial** | nicht realisiert; `Spatial`/`Brainwave` sind DSP-R&D, nicht Voice (Pitch/Formant/Vocoder) |
| VibeCore AI | **Production Candidate** | nicht-invasiv (schreibt nur `store`), Core `InvokeLLM`, Ergebnisse optional; externes Modellverhalten nicht deterministisch |
| VibeCore Remix | **Partial** | nicht realisiert; Container-Plugin-Slot reserviert (`vcl3.remix.stemSet`) |

**Locked:** noch kein Modul bewusst stabilisiert (`§10.4`) — steht an, sobald ein Modul dauerhaft eingefroren werden soll.

---

## F. Modul-Abnahmekriterien (Band 4 §6) — Status

- **Sync (§6.1):** erfüllt — Clock/Transport/Start-Stop-Continue/Positionen/Drift/interne+externe Pfade (`externalStubs`).
- **Groove (§6.2):** erfüllt — Sequencer/Probability/Ratchets/Swing/Humanize/Pattern-Scene-Wechsel/Piano-Roll-Konsistenz.
- **3D Synth (§6.3):** erfüllt — Voice-Management/Synthese/Modulation/Presets/Polyphonie+CPU.
- **3D Bass (§6.4):** erfüllt — Bass-Engine/Low-End/Sub-Mid/Presets/Performance+Phase (Phase via deterministischer Oszillatoren).
- **FX Mix Lab (§6.5):** erfüllt — Routing/Sends-Returns-Busse/Sidechain/Metering/Master.
- **Sample Forge (§6.6):** **teilweise** — Slice/Pitch/Time-Stretch/eingebettete Assets erfüllt; **Streaming großer Samples offen** → Gate 3 für große Lasten noch nicht final.
- **Voice (§6.7):** **nicht erfüllt** → eigenes Modul-Arbeitsband.
- **AI (§6.8):** erfüllt — nicht-invasiv, kein Realtime-Block, optional/nachvollziehbar.
- **Remix (§6.9):** **nicht erfüllt** → eigenes Modul-Arbeitsband.

---

## G. Definition of Done — Checkliste (Band 4 §5)

Vor Freigabe einer Änderung geprüft (alle Boxen ☑):

- [ ] **Funktional:** Kernfunktion implementiert, Fachlogik vollständig, Sonderfälle, keine Platzhalter
- [ ] **Architektur:** klar abgegrenzt, Deps erlaubt+dokumentiert (`MODULE_CONTRACTS`), keine Doppelimpl.
- [ ] **Realtime/Audio:** Pfad stabil, kein Timing-/Audio-Regress, keine UI-Abh. im Audiopfad, keine Blocks
- [ ] **Daten:** Zustände konsistent, Persistenz versionierbar, Migrationen vorgesehen, Import/Export korrekt
- [ ] **Tests:** relevante Tests existieren+laufen, Kern-/Fehlerfälle abgedeckt, Regressionen abgesichert
- [ ] **Dokumentation:** Änderungen/Risiken/Architekturentscheidungen/offene Punkte dokumentiert
- [ ] **Gates G1–G5** alle bestanden
- [ ] **Reifegrad** zugewiesen und begründet

---

## H. Fehlerbehandlung & Regression (Band 4 §11, §12) — Durchsetzung

- **Keine stillen Fehlschläge:** `parseContainer`/`detectAndLoad` werfen präzise Fehler (`manifest.json fehlt`, `Container-Format-Version … nicht unterstützt`, `Integritätsprüfung fehlgeschlagen`).
- **Integrität sichtbar:** Body-SHA-256-Mismatch → **Ablehnung**; Asset-Mismatch → Drop + `assetIntegrity[uuid]=false` (sichtbar).
- **Fehlertexte valide:** `enforcePolicy` liefert `Signatur erforderlich, aber nicht gültig (state): reason`.
- **Regressionsschutz:** `MIGRATIONS`-Registry + `formatVersion`-Gate garantieren, dass alte Projekte nicht unbrauchbar werden; Selbsttests decken Tamper/v1-Erkennung/Kompressions-Toggle ab.

---

## I. Verbotene Freigabeformen (Band 4 §15) — Sperren

Freigabe blockiert bei: fehlendem Test · fehlender Doku · offener Realtime-Gefährdung · Dateninkonsistenz · offener Doppelarchitektur · unklarer Migration · nicht dokumentierten Risiken. Konkret: Gate-Ausfall (G1–G5) → keine Reifegrad-Erhöhung; `runAudioTimingTest=FAIL` → kein G3.

---

## J. Nächste Schritte (Band 4 §18)

Keine weiteren allgemeinen Governance-Bänder. Nächste Phase = **modulspezifische Arbeitsbänder** (VibeCore Sync, Audio Engine, DSP Core, Groove, Sample Forge, FX Mix Lab, Voice, AI, Remix), die sich an Band 1–4 halten. Priorität aus `MODULE_CONTRACTS` §G: **Voice** und **Remix** als nicht-realisierte Kernmodule; **Sample Forge Streaming** als offene Gate-3-Last.

---

*Band 4 schließt die Governance-Reihe (Band 1 Arbeitsmodus → Band 2 Architektur → Band 3 Entwicklungsdisziplin → Band 4 QA/Freigabe) ab. Das Regelwerk ist vollständig formalisiert; die modulare Umsetzung kann sauber aufbauen.*