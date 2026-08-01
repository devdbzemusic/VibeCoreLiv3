# VibeCoreLiv3 — Module Contracts & Dependency Audit

**Bezug:** MASTERPROMPT BAND 2 (Architekturgesetz) · **Board-Auftrag §16 #1/#2/#6** — Modul-Zuordnung, Abhängigkeitsprüfung, Dokumentation modularer Entscheidungen.
**Status:** Verbindlich · **Stand:** 2026-07-31

Dieses Dokument mappt die neun Kernmodule auf die **existierende** Codebasis, legt Eigentümerschaft, erlaubte Abhängigkeiten und Status fest und auditet die Plattform gegen die verbotenen Architekturformen (§15) und Persistenzregeln (§12). Es ersetzt keine modulbezogenen Arbeitsbänder — es ist der Vertragskatalog, auf dem diese aufbauen.

---

## A. Modul-Registry

Legende: **Status** = `production` · `partial` · `missing`. **Deps** = erlaubte Abhängigkeiten gemäß §9.

| # | Modul | Eigentümer (Dateien) | Deps | Status |
|---|-------|----------------------|------|--------|
| 1 | **VibeCore Sync** | `src/lib/audio/scheduler.ts` · `src/lib/clock/{masterClock,tapTempo,divisions,types}` · `src/lib/clock/sources/{internalSource,externalStubs}` · `src/lib/sync/adaptiveSync.ts` · `src/components/groovebox/SyncTab.tsx` · Transport-Slice in `src/lib/store.ts` | — (Zeitbasis) | production |
| 2 | **VibeCore Groove** | `src/lib/store.ts` (Pattern/Scene/Step/Note-Domain) · `src/lib/model.ts` · `src/lib/groovePresets.ts` · `src/components/groovebox/{SeqTab,PianoRollTab,RollDrumLane,RollPlayhead,PartStrip,PtnTab}.tsx` | → Sync | production |
| 3 | **VibeCore 3D Synth** | `src/lib/audio/{synthVoice,voiceAllocator,modulation,psychoPresets}.ts` · Synth-Pfad in `engine.ts` · `src/lib/forge/**` (Graph + `FMSourceNode`, `NoiseSourceNode`, `EnvPercNode`, `SampleSourceNode`, `presets`, `registry`, `render`, `types`) · `src/components/groovebox/SoundTab.tsx` | → Sync | production |
| 4 | **VibeCore 3D Bass** | `src/lib/audio/gravLaceBass.ts` (GravLace: Lace/Gate/Warper) | → Sync | production |
| 5 | **VibeCore FX Mix Lab** | `src/components/groovebox/{FxTab,MixTab,ChannelStrip}.tsx` · `src/lib/audio/meterBus.ts` · `src/hooks/useMeter.ts` · Routing-Typen (`FxSlot`,`FxRouting`,`Channel`,`MasterChannel`) in `model.ts` | → Sync + Audio Engine | production |
| 6 | **VibeCore Sample Forge** | `src/lib/audio/{sampleLibrary,sampleForge,granular}.ts` · `src/workers/granular-processor.worklet.ts` · `src/components/groovebox/{SmplTab,library/SampleLibrary}.tsx` | → Sync + Asset Service | production |
| 7 | **VibeCore Voice** | _(noch kein dediziertes Modul)_ — `SpatialTab`/`BrainwaveTab` + `quantumSpatial.ts`/`brainwave.ts` sind **DSP-R&D**, **nicht** Voice (Vocal/Pitch/Formant/Vocoder) | → Sync + Audio Engine | **partial / nicht realisiert** |
| 8 | **VibeCore AI** | `src/lib/audio/aiSceneBuild.ts` · `src/components/groovebox/{AiSceneTab,AiCoAssistant,library/GroovePresetLibrary}.tsx` · Core `InvokeLLM` (Host-Integration) | → Host + State + Diagnostics | production (Assistenz, nicht-invasiv) |
| 9 | **VibeCore Remix** | _(keine Implementierung)_ — reserviert im `.vcl3`-Container via `plugins/<uuid>.json` (`kind: "vcl3.remix.stemSet"`) siehe Spec §10/§18 | → Asset Service + Project Format + Sync | **missing (designed Slot)** |

---

## B. Gemeinsame Plattformdienste (§7) — Realisierung

| Dienst | Realisierung |
|--------|--------------|
| **Transport Service** | Transport-Slice in `store.ts` (`togglePlay`, `queuePattern`, `setChain`, `setChainMode`, Scene-/Pattern-Wechsel) + `scheduler.ts::advancePattern` + UI `TopBar`/`SyncTab` |
| **Clock / Scheduler Service** | Look-ahead-Scheduler `scheduler.ts` (AudioContext.currentTime-Grid) + `clock/masterClock` (interne Quelle, `source === "internal"`) + `audioClockProbe` (Sample-accurate Messung) |
| **State Service** | Zustand in `store.ts` (Zustand+persist) · `vcl3/projectFormat` (Projekt-Serialisierung) · Undo/Redo in `PianoRollTab` (Snapshot-Stacks via `replaceNotes`) |
| **Audio Graph Service** | Graph-Construction in `engine.ts` · `meterBus.ts` (Peaks/RMS/Clip) · Channel Strips · Master-Struktur in `model.ts` |
| **Asset Service** | `sampleLibrary.ts` · Container-Assets (`vcl3/container.ts` → `assets/<uuid>.wav`) · `sampleForge.ts` |
| **Diagnostics Service** | `audioPerf.ts` · `patternTimingValidator.ts` · `audioClockProbe.ts` · `runAudioDiagnostics.ts` · `DiagPanel`/`DiagnosticsModal` · `mainThreadMonitor.ts` · `stressTests.ts` |

---

## C. Abhängigkeits-Audit (§9)

**Erlaubte Kanten — alle aktuell über definierte Verträge geleitet (Store-Actions / `triggerPart` / `masterClock`):**

- Groove → Sync: Groove liest/`setzt` Patterns über `store`; der Scheduler (`Sync`) konsumiert `store.transport` + `patterns`. Keine eigene Groove-Clock. ✓
- 3D Synth → Sync: `synthVoice`/`voiceAllocator` werden über `triggerPart` (Scheduler → Engine) getriggert; Timing kommt vom Sync-Grid. ✓
- 3D Bass → Sync: `gravLaceBass` läuft durch den zentralen `voiceAllocator` + `triggerPart`-Pfad; kein eigener Takt. ✓
- FX Mix Lab → Sync + Audio Engine: FX-Parameter via `store`-Actions; Metering (`useMeter`/`meterBus`) rein beobachtend. ✓
- Sample Forge → Sync + Asset Service: Samples geladen via `assignBufferToPart`; Container-Assets via `vcl3/container.ts` (Asset-Verzeichnis im Manifest). ✓
- AI → Host + State + Diagnostics: `aiSceneBuild` schreibt Patterns **nur** in `store`; `AiCoAssistant` nutzt Core `InvokeLLM` (Host). **Kein direkter DSP-/triggerPart-Zugriff.** ✓ (§5.4, §8.8 Nichtinvasivität)
- Remix → Asset Service + Project Format + Sync: noch nicht realisiert; Slot via Container `plugins/<uuid>.json` reserviert. N/A.

**Verbotene Kanten — Prüfung:**

| Verbot | Status |
|--------|--------|
| Groove direkt an Remix | Remix absent → N/A |
| Synth direkt an Sample-Container | Synth liest nur aus Engine-Buffern, die Sample Forge via `assignBufferToPart` (Vertrag) zuweist — kein Direktzugriff auf Container-Interna. ✓ |
| FX direkt an UI-State | FX-Param in `store`; UI setzt via Actions; Metering observe-only; FX liest nicht UI, UI liest FX via `store`. ✓ |
| AI direkt an Audiopfad | AI schreibt ausschließlich in `store`; ruft nie `triggerPart`/DSP. ✓ |
| Remix direkt an DSP-Interna | Remix absent → N/A |
| Interne Implementierungsdetails modulübergreifend | Module interagieren über `store`-Actions + `triggerPart`-Vertrag; keine Fremd-Internas. ✓ |

---

## D. Verbotene Architekturformen (§15) — Audit

| Verbot | Befund |
|--------|--------|
| Monolithischer Audio-Sammelcode | `engine.ts` ist groß, aber **Integrations-Hub**; DSP ist entlang `synthVoice`/`gravLaceBass`/`voiceAllocator`/`meterBus` modular getrennt. Akzeptabel; `engine.ts` als Graph-Service-Hub dokumentiert. |
| UI-gesteuerte Audioverarbeitung | UI setzt nur Parameter/Liest Status; Timing ausschließlich vom Scheduler (AudioContext-Grid). ✓ |
| Doppelte Clock-Logik | **Eine** Zeitbasis: `AudioContext.currentTime` + `masterClock` (intern). Kein konkurrierender Timer als Hauptquelle. ✓ |
| Doppelte Projektmodelle | v1 + v2 teilen sich **ein** `ProjectState`; v2 bettet v1 unverändert ein. ✓ |
| Ungeprüfte Direktzugriffe zwischen Modulen | Modulübergreifend nur über `store` + `triggerPart` + `masterClock` (Verträge). ✓ |
| Globale Schattenzustände ohne Vertrag | `store` ist Single-Source-of-Truth. `setupStore.ts` (Setup-/Session-Config) ist dokumentierter Session-Zustand, keine Schatten-Logik. ✓ |
| Unsaubere Abkürzungen | Legacy `downloadVcl3` (v1-JSON) koexistiert mit `downloadVcl3Container` (v2) — **dokumentiert als v1-Interop-Fallback**, keine zweite Projektlogik (beide nutzen `ProjectState`). ✓ |

---

## E. Persistenzschichten (§12) — Trennung

| Schicht | Inhalt | Persistiert? |
|---------|--------|--------------|
| Realtime State | `AudioContext`, Scheduler-Globals (`globalTick`/`nextTickTime`/`stepInScene`), `voiceAllocator`-Live-Voices | **nein** (flüchtig) |
| Session State | `store`-Transient-Slices (`cpu`/`voices`/`peaks`/`playheads`/`fps`/`limiterReduction`) | **nein** (`partialize` schließt Metering aus, `transport.playing=false`) |
| Project State | `vcl3` `project.json`-Body (`ProjectState`) | **ja** (v1/v2) |
| Asset State | Container `assets/<uuid>.wav` + Manifest-Asset-Verzeichnis | **ja** (eingebettet) |
| Container State | `manifest.json` + `signature` (Ed25519) + `integrity` | **ja** (Container) |
| Diagnostic State | `audioClockProbe`-Events, `audioPerf`-Metrics | **nein** (In-Memory-Ringbuffer) |

Trennung gewahrt: UI-Fehler → kein Projektkern-Schaden; Importfehler → kein Realtime-Destabilisieren (`loadProject` stoppt deterministisch); temporärer Zustand → nicht als Projektrealität persistiert. ✓

---

## F. Datenintegrität (§11)

- Projekt-Identität: UUIDv4 pro Container (`manifest.uuid`). ✓
- Scene/Pattern adressierbar: `pattern.id` + `sceneIdx` (1..8), `MAX_SCENES_PER_PATTERN`. ✓
- Samples/Presets referenzierbar: Asset-UUID + `partId`/`sampleName`-Mapping im Manifest. ✓
- Import validiert: `validateProject` (Schema) + SHA-256-Integrität + optional Ed25519-Signatur. ✓
- Orphans bereinigt: `sanitizeStatePatch` entfernt verwaiste Scene→Part-Referenzen beim Laden. ✓
- Versionen migrierbar: `MIGRATIONS`-Registry (`projectFormat`) + Container-`formatVersion`-Gate. ✓

---

## G. Lücken & nächste Schritte

1. **VibeCore Voice (§8.7):** nicht realisiert. `SpatialTab`/`BrainwaveTab` sind DSP-R&D, **kein** Voice-Modul (Pitch/Formant/Harmonizer/Vocoder). → eigenes modulbezogenes Arbeitsband.
2. **VibeCore Remix (§8.9):** nicht realisiert; Container-Slot reserviert. → eigenes Arbeitsband auf Asset-Service + Project-Format + Sync.
3. **Per-Modul-Arbeitsbänder** (Band-pro-System) folgen gemäß §18 — nicht in diesem Dokument.
4. **Band 3** (Coding Standards & Realtime Rules) und **Band 4** (QA, Tests & Release Gates) sind die nächsten plattformweiten Bänder.

---

## H. Verbindliche Modul-Entscheidungen (§16 #6)

- **Single Clock:** `AudioContext.currentTime` + `masterClock` (intern) ist die einzige Zeitquelle. Jegliche Modul-Timing läuft über `scheduler.ts` bzw. `masterClock`-Subskription.
- **DSP/UI-Trennung:** Alle Audioberechnung in `src/lib/audio/**` + `src/workers/**`; UI in `src/components/**` nur lesend/param-setzend.
- **Vertragskommunikation:** Modulübergreifend ausschließlich via `store`-Actions, `triggerPart(partId, when, params)` und `masterClock`-Ereignisse.
- **Persistenz-Einbahnen:** v2-Container ist der verbindliche Projekt-Austauschpfad; v1-JSON ist dokumentierter Interop-Fallback; kein zweiter Exportpfad.
- **Erweiterung nur sauber:** Neue Module/Dienste werden einem der neun Kernmodule zugeordnet oder als Plattformdienst deklariert — keine Ad-hoc-Module außerhalb dieser Liste.

---

*Dieses Dokument ist der Vertragskatalog der Plattform. Modulbezogene Arbeitsbänder pro Kernsystem bauen auf diesen Zuordnungen und Abhängigkeiten auf.*