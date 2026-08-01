# VibeCoreLiv3 — Source-Code-Übergabe an das Entwicklerteam

> Vollständige Code-Basis für die Übernahme. **Leitlinien/Governance-Docs sind
> gemäß Vorgabe ausgeschlossen** — dieses Manifest listet nur ausführbaren
> Source, Konfiguration, Schemata und Asset-Referenzen.

## 1. Bezugsquelle

Die Code-Basis wird über die **Base44 ↔ GitHub 2-Wege-Sync** bereitgestellt.

1. Im App-Editor: **GitHub-Icon → Connect to GitHub → Connect GitHub**
2. **Authorize Base44 Builder**, Organisation/Konto wählen, Repo-Zugriff erlauben → **Install**
3. Repo erzeugen: Org/Konto + Name (Empfehlung: `vibecore-liv3`) → **Create Repository**
4. **GitHub-Icon → Go to Repository** öffnet das Repo für das Team

Team-Workflow:
```
git clone <repo-url>
npm install
# .env.local anlegen:
#   VITE_BASE44_APP_ID=<app-id>
#   VITE_BASE44_APP_BASE_URL=<backend-url>
npm run dev        # lokaler Dev-Server
npm run build      # Produktions-Build → ./dist
npm run lint       # ESLint
npm run typecheck  # tsc (jsconfig)
```
Änderungen nach **`main`** mergen → erscheinen in der Base44-App → **Publish** klickt das Team live.
> 2-Wege-Sync braucht Builder-Plan+, nur der App-Owner stellt die Erstverbindung her; Branch muss `main` heißen; Repo-Verbindung ist dauerhaft.

---

## 2. Projektstruktur (Ordner & Dateien)

```
vibecore-liv3/
├── index.html                     # HTML-Shell, Fonts (Orbitron/JetBrains Mono/Inter), SEO, manifest
├── package.json                   # Abhängigkeiten & Skripte (s. §4)
├── vite.config.js                 # Vite + @base44/vite-plugin (legacy SDK, HMR, Analytics)
├── jsconfig.json                  # TS-Check-Config, @/* → ./src/*, JSX/ESNext
├── tailwind.config.js             # Tailwind-Theme + Token-Mapping
├── postcss.config.js              # Tailwind/Autoprefixer
├── eslint.config.js              # Lint-Regeln
├── components.json                # shadcn/ui-Konfig
├── .gitignore
├── base44/
│   └── config.jsonc               # Plattform-Build-Config (Name: "SonicArchitect")
├── public/
│   ├── robots.txt
│   ├── favicon.ico (referenziert)
│   └── manifest.json (referenziert)
├── src/
│   ├── main.jsx                   # React-Einstiegspunkt
│   ├── App.jsx                    # Router, AuthProvider, QueryClient, Toaster
│   ├── App.css
│   ├── index.css                  # Design-Tokens (HSL), Komponenten-Klassen, Mobile-Overrides
│   ├── api/
│   │   └── base44Client.js        # Pre-initialisierter Base44-SDK-Client
│   ├── lib/
│   │   ├── utils.js               # cn() etc.
│   │   ├── utils/random.ts        # mulberry32, hashSeed (deterministische RNGs)
│   │   ├── model.ts               # Core-Datenmodell: Part/Scene/Pattern/Step/Note/FX/Mod
│   │   ├── store.ts               # Zustand-Store (Pattern-Domain v12) + Persist + Migrate
│   │   ├── query-client.js
│   │   ├── app-params.js
│   │   ├── authReturnTo.js
│   │   ├── AuthContext.jsx
│   │   ├── PageNotFound.jsx
│   │   ├── groovePresets.ts       # Persistierbare Groove-Preset-Bibliothek (Zustand/Persist)
│   │   ├── audio/
│   │   │   ├── engine.ts           # Web-Audio-Engine, Master-Gain, AudioContext
│   │   │   ├── AudioBackend.ts     # Swappable-Backend-Interface + Factory
│   │   │   ├── NativeOboeBackend.ts # JS-Bridge → Android Oboe (window.VibeCoreNative)
│   │   │   ├── scheduler.ts        # Lookahead-Scheduler, Bindings
│   │   │   ├── synthVoice.ts       # Synth-Stimmen
│   │   │   ├── sampleLibrary.ts    # Prozedural offline-rendered Samples
│   │   │   ├── sampleForge.ts      # DSP: Normalize/Trim/Fade/Pitch/Stretch/Freeze/Chop
│   │   │   ├── granular.ts         # Granular-Synthese
│   │   │   ├── brainwave.ts        # Brainwave/Audio-Analyse
│   │   │   ├── modulation.ts       # Mod-Routen → AudioParams
│   │   │   ├── quantumSpatial.ts   # Räumliche Audio-Matrix
│   │   │   ├── psychoPresets.ts    # Psychoakustische Presets
│   │   │   ├── prodRender.ts       # Prozeduraler Renderer (Worker-Dispatch)
│   │   │   ├── quality.ts          # Adaptive Qualität (LOW/MED/HIGH), Geräte-Tuning
│   │   │   ├── meterBus.ts         # Meter-Bus (non-React)
│   │   │   ├── clickDetect.ts
│   │   │   ├── audioClockProbe.ts
│   │   │   ├── audioPerf.ts
│   │   │   ├── mainThreadMonitor.ts
│   │   │   ├── patternTimingValidator.ts
│   │   │   ├── runAudioDiagnostics.ts
│   │   │   ├── stressTests.ts
│   │   │   ├── aiSceneBuild.ts     # ★ KI-Assistent: buildGroove/buildMelody (sync-aware)
│   │   │   └── audioGraphDebug.ts
│   │   ├── clock/                  # ★ VibeCore Sync — einzige Timing-Autorität
│   │   │   ├── masterClock.ts      # MasterClock (BPM, beatsPerBar, source)
│   │   │   ├── divisions.ts
│   │   │   ├── types.ts
│   │   │   └── sources/
│   │   │       ├── internalSource.ts
│   │   │       └── externalStubs.ts
│   │   ├── sync/
│   │   │   └── adaptiveSync.ts     # Adaptive Synchronisation externer Quellen
│   │   ├── setup/
│   │   │   ├── setupStore.ts
│   │   │   ├── clockTest.ts
│   │   │   ├── devices.ts
│   │   │   └── latencyTest.ts
│   │   └── forge/                  # Node-basierter DSP-Forge-Graph
│   │       ├── graph.ts, node.ts, presets.ts, registry.ts, render.ts, types.ts
│   │       └── nodes/ (EnvPercNode, FMSourceNode, NoiseSourceNode, SampleSourceNode)
│   ├── workers/
│   │   ├── prodRender.worker.ts          # Procedural-Render-Worker
│   │   └── granular-processor.worklet.ts # AudioWorklet (granular)
│   ├── hooks/
│   │   ├── useMeter.ts
│   │   ├── useDiagnosticsTrigger.ts
│   │   ├── use-toast.ts
│   │   ├── use-mobile.jsx
│   │   └── use-size.jsx
│   ├── utils/index.ts
│   ├── components/
│   │   ├── ProtectedRoute.jsx, ScrollToTop.jsx, NavLink.tsx
│   │   ├── AuthLayout.jsx, GoogleIcon.jsx, UserNotRegisteredError.jsx
│   │   ├── ui/                      # shadcn/ui (komplette Primitive-Bibliothek)
│   │   └── groovebox/               # ★ Groovebox-UI (Tabs & Panels)
│   │       ├── TopBar.tsx, TabBar.tsx
│   │       ├── SeqTab.tsx, PianoRollTab.tsx, MixTab.tsx, FxTab.tsx
│   │       ├── SmplTab.tsx, SoundTab.tsx, BrainwaveTab.tsx, SpatialTab.tsx
│   │       ├── AiSceneTab.tsx, AiCoAssistant.tsx     # ★ KI-Assistent-UI
│   │       ├── ProdTab.tsx, SyncTab.tsx, SetupTab.tsx, LibTab.tsx
│   │       ├── DiagPanel.tsx, DiagnosticsModal.tsx
│   │       ├── ChannelStrip.tsx, PartStrip.tsx, PtnTab.tsx, ForgeTab.tsx
│   │       └── library/
│   │           ├── SampleLibrary.tsx
│   │           └── GroovePresetLibrary.tsx
│   └── pages/
│       ├── Index.tsx               # Hauptseite (TopBar + Tab-Inhalte + TabBar)
│       ├── Login.jsx, Register.jsx, ForgotPassword.jsx, ResetPassword.jsx
├── native-android/                  # ★ Native Android Oboe-Engine (C++/AAudio)
│   ├── README.md
│   ├── app/build.gradle.kts
│   └── app/src/main/
│       ├── java/com/vibecore/audio/NativeAudioBridge.kt
│       └── cpp/
│           ├── CMakeLists.txt
│           ├── vibecore_engine.h
│           ├── vibecore_engine.cpp   # Oboe real-time mixer, ADPF, big-core Affinity
│           └── jni_bridge.cpp        # JNI-Brücke ↔ Kotlin
└── vibecore-platform/               # Native C++-Plattform-Backbone
    ├── README.md, ROADMAP.md, CHANGELOG.md, CONTRIBUTING.md,
    │   CODING_STANDARD.md, LICENSE.md
    ├── ci/ (build.yml, test.yml)     # Multi-Platform CI
    ├── schemas/ (project/preset/asset/module/scene.schema.json)
    └── diagrams/ (layer-model, thread-model, clock-distribution .mmd)
```

> **Hinweis Governance-Docs:** `vibecore-platform/docs/00–24_*.md` sind
> Spezifikations-/Leitlinien-Dokumente und werden gemäß Vorgabe **nicht**
> übergeben. Die C++-Implementierung der Phase 1 (Platform Core) steht noch aus
> (siehe ROADMAP).

---

## 3. JavaScript / TypeScript-Dateien (Source-Code)

**Frontend-Engine (Vite + React + Tailwind, ESM):**
- `src/main.jsx`, `src/App.jsx` — Bootstrap, Routing, Auth-Provider, QueryClient
- `src/lib/store.ts` — Zustand-Store (Pattern-Domain v12, Persist, Migration)
- `src/lib/model.ts` — Datenmodell: `Part`, `Scene`, `Pattern`, `Step`, `Note`, `Channel`, `FxSlot`, `ModRoute` + Builder/Defaults
- `src/pages/Index.tsx` — Groovebox-Hauptseite
- Auth-Seiten: `src/pages/{Login,Register,ForgotPassword,ResetPassword}.jsx`

**Audio-Engine (`src/lib/audio/`):**
- `engine.ts` (Web Audio, Master, AudioContext), `scheduler.ts` (Lookahead)
- `AudioBackend.ts` + `NativeOboeBackend.ts` (Dual-Engine, swappable)
- `synthVoice.ts`, `sampleLibrary.ts`, `sampleForge.ts`, `granular.ts`
- `quality.ts` (adaptiv), `meterBus.ts`, `modulation.ts`, `psychoPresets.ts`
- `prodRender.ts` + `src/workers/prodRender.worker.ts`
- `src/workers/granular-processor.worklet.ts` (AudioWorklet)
- Diagnose: `runAudioDiagnostics.ts`, `stressTests.ts`, `audioPerf.ts`, `audioClockProbe.ts`, `mainThreadMonitor.ts`, `patternTimingValidator.ts`, `audioGraphDebug.ts`

**Sync/Clock (`src/lib/clock/`, `src/lib/sync/`):**
- `masterClock.ts` (einzige Timing-Autorität), `divisions.ts`, `sources/internalSource.ts`, `sources/externalStubs.ts`
- `sync/adaptiveSync.ts` (externer Source → MasterClock)

**KI-Assistent (s. §7):**
- `src/lib/audio/aiSceneBuild.ts` — `buildScene`, `buildGroove`, `buildMelody`
- `src/components/groovebox/AiSceneTab.tsx`, `AiCoAssistant.tsx`

**UI-Komponenten (`src/components/groovebox/`):**
- 14 Workflow-Tabs + TopBar/TabBar + Diagnose + Library
- shadcn/ui-Primitive: `src/components/ui/*.jsx` (vollständiger Satz)

---

## 4. Konfigurationsdateien

| Datei | Zweck |
|---|---|
| `package.json` | Abhängigkeiten (React 18, Vite 6, Tailwind 3.4, Zustand 5, Three.js, Recharts, react-router, react-query, Stripe, …), Skripte: dev/build/lint/lint:fix/typecheck/preview |
| `vite.config.js` | Vite + `@base44/vite-plugin` (legacySDK, HMR/Navigation/Analytics/VisualEdit) |
| `jsconfig.json` | TS-Check, `@/* → ./src/*`, JSX react-jsx, ESNext, checkJs |
| `tailwind.config.js` | Theme-Extend: Farben aus HSL-Tokens, fontFamily (display/body/mono), Radius-Mapping, animate-Plugin |
| `postcss.config.js` | Tailwind + Autoprefixer |
| `eslint.config.js` | Lint-Regeln (react, react-hooks, unused-imports) |
| `components.json` | shadcn/ui-Konfiguration |
| `base44/config.jsonc` | Plattform-Build (name `SonicArchitect`, install/build/serve/output `./dist`) |
| `index.html` | HTML-Shell, Fonts, SEO, theme-color, manifest/favicon |

---

## 5. Datenbank-Schemata & Migrationen

**Base44-Entities:** In dieser App sind **keine `base44/entities/*.jsonc`**
definiert — VibeCore nutzt keinen serverseitigen Entity-Store. Alle
Projektdaten liegen clientseitig (s. §6).

**Persistenz & Migration (Zustand/Persist):**
- Speicher: `localStorage`, Key `vibecore-liv3-project`
- Datei: `src/lib/store.ts` → `persist({ name, version: 12, partialize, migrate })`
- `partialize`: bpm, masterVolume, master, parts, patterns, fx, fxRouting, fxSharedFloor, mod, selectedPattern, selectedSceneIdx, qualityProfile, psychoPreset, transport(chain/chainMode/currentPattern)
- **Migration:** v<12 → discard (Pattern-Domain-Break: `partScenes` → `scenes[]`). Aktuelle Version: **12**.

**JSON-Schemata (native Plattform, `vibecore-platform/schemas/`):**
`project.schema.json`, `preset.schema.json`, `asset.schema.json`, `module.schema.json`, `scene.schema.json` — für das C++-Plattform-Projekt.

---

## 6. Assets (Bilder, Icons, Audio, Schriftarten)

- **Schriftarten:** via Google Fonts CDN in `index.html` geladen — **Orbitron** (display), **JetBrains Mono** (mono), **Inter** (body). Keine lokalen Font-Dateien.
- **Icons:** `lucide-react` (npm) — keine lokalen Icon-Dateien.
- **Audio:** Vollständig **prozedural** — keine statischen Audio-Dateien.
  - `src/lib/audio/sampleLibrary.ts` rendert Sounds offline zur Laufzeit.
  - `src/lib/audio/prodRender.ts` + `src/workers/prodRender.worker.ts` generieren One-Shots.
  - `src/lib/audio/synthVoice.ts` synthetisiert Stimmen.
  - `src/components/groovebox/library/SampleLibrary.tsx` cached `AudioBuffer`s in einem globalen `renderCache`.
  - WAV-Export im Client (`ProdTab.tsx`).
- **Bilder:** keine statischen Content-Bilder; UI ist Vektor/CSS.
- **PWA-Assets:** `public/manifest.json` + `favicon.ico` (referenziert in `index.html`).

---

## 7. KI-Prompts / Agenten-Anweisungen

VibeCore nutzt **keine externen LLM-Prompts** im Projekt. Die KI-Assistenz ist
eine **deterministische, rein funktionale Engine** (kein Netzaufruf, kein
Prompt-Store):

- **`src/lib/audio/aiSceneBuild.ts`** — Core-Algorithmen:
  - `buildScene(opts)` — einzelner Part (Context-Merge, Bar-Hierarchie)
  - `buildGroove(opts)` — koordinierter Drum-Groove über Kick/Snare/Hat/Perc, erhält bestehende User-Hits, bar-aligned
  - `buildMelody(opts)` — Motiv-Call-&-Response, tonale Auflösung zur Root an Taktgrenzen, Stepwise-Motion + Akkordton-Sprünge; **Bass locked auf Kick-Hits**
  - RNG: `mulberry32(hashSeed(...))` → deterministisch (gleicher Seed = identisches Ergebnis)
  - **Sync-Contract:** liest nur `beatsPerBar` + `length` aus dem MasterClock; **kein eigener Timer, kein setTempo**; Swing delegiert an Pattern/Scheduler (kein Zufalls-Micro-Timing)
- **`src/components/groovebox/AiCoAssistant.tsx`** — UI: Mode GROOVE/MELODY, Style/Scale/Root/Density/Swing/Seed, liest `masterClock.getState()` für Sync-Status, schreibt über Store (`setPatternSteps`/`setNotes`)
- **`src/components/groovebox/AiSceneTab.tsx`** — manueller Part-Builder (vorkonfigurierte Presets)

Die 15-Spezialisten-Masterplan-Texte sind **Leitlinien** und gemäß Vorgabe
ausgeschlossen.

---

## 8. Native Komponenten (separate Build-Strecken)

**Android Oboe-Engine (`native-android/`)** — nicht Teil des Vite-Builds; baut in Android Studio:
- `app/src/main/cpp/vibecore_engine.{h,cpp}` — Oboe real-time Mixer, Voice-Management, ADPF, big-Core-Affinity, 96-Frame-Burst
- `app/src/main/cpp/jni_bridge.cpp` — JNI ↔ Kotlin
- `app/src/main/java/com/vibecore/audio/NativeAudioBridge.kt` — `@JavascriptInterface` ↔ WebView (`window.VibeCoreNative`)
- Bridge erkannt in `src/lib/audio/AudioBackend.ts` → `NativeOboeBackend.ts`

**C++-Plattform (`vibecore-platform/`)** — CMake/CI/SDK-Backbone (separate Repo-Struktur):
- `ci/build.yml`, `ci/test.yml`
- `schemas/*.schema.json`
- `diagrams/` (Mermaid: Layer/Thread/Clock)
- Implementierung Phase 1 (Platform Core) noch offen (ROADMAP)

---

## 9. Build & Auslieferung

- Web-App: `npm run build` → `./dist` (Vite), gehostet via Base44
- Android-Native: Android Studio (Oboe/CMake) → WebView lädt die Web-App; Native-Engine via Bridge
- Veröffentlichung: Base44 **Publish** (nach `main`-Merge) → iOS/Android aus gleichem Code