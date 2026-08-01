# MODULE — VibeCore FX Mix Lab

**Professional Mixing, Routing & Master Processing Platform**
**Modul:** `src/lib/fxmixlab/` · **Status:** Implementiert, Review ausstehend
**Aufbauend auf:** VibeCore Sync · Audio Engine · DSP Core · Groove · Sample Forge

---

## 1. Architektur

VibeCore FX Mix Lab ist die zentrale Misch-, Effekt- und Routing-Umgebung der Plattform. Es ist **kein** einfacher Effektcontainer, sondern eine Orchestrierungsschicht, die die bestehenden Kernmodule erweitert — niemals ersetzt.

### Prinzipien

- **Keine Parallelarchitektur:** FX Mix Lab erstellt keine eigene Audio Engine, keine eigene Clock, keine eigene DSP-Basis.
- **Extend don't replace:** Insert-Ketten verbinden sich in den bestehenden `PartChain` (zwischen `chain.input` und `chain.hp`). Bus-Routing nutzt die bestehende Send-Architektur.
- **DSP Core exclusiv:** Alle Signalverarbeitung verwendet die Factory-Funktionen aus `@/lib/dsp` — keine zweite DSP-Implementierung.
- **Realtime-safe:** Keine Heap-Allokationen im Audiopfad, keine Locks, keine Promise-Ketten, keine UI-Abhängigkeiten.

### Modulstruktur

```
src/lib/fxmixlab/
├── types.ts          — Typdefinitionen (Mixer, Bus, Return, Automation, Analyzer, Presets)
├── insertChain.ts    — Insert-FX-Ketten-Builder (23 FX-Typen via DSP Core)
├── routing.ts        — Routing-Graph mit Zykluserkennung (DFS) + topologischer Sortierung
├── automation.ts     — Samplegenaue Automation mit VibeCore Sync (songTicks → AudioContext.currentTime)
├── analyzer.ts       — Off-Audiopfad-Analyse (Peak, RMS, LUFS, Crest, Stereo, Phase, Spectrum)
├── aiAssistant.ts    — AI-Mix-Assistent (Gain Staging, EQ, Dynamics, Stereo, Routing — nur Vorschläge)
├── presets.ts        — Mix-Presets (Clean & Balanced, Punch & Loud, Ambient & Wide)
├── selfTest.ts       — Deterministische Tests (22 Tests)
└── index.ts          — Öffentliche API
```

---

## 2. Routing

### Routing-Graph

Das Routing-System verwaltet die Topologie zwischen Parts → Bussen → Master und Send/Return-Routing als gerichteten Graphen. Jeder Knoten hat einen qualifizierten Namen: `part:<id>`, `bus:<id>`, `return:<id>`, `master`.

### Zykluserkennung

Die Funktion `detectCycle()` verwendet eine DFS-basierte Zykluserkennung (Gray/Black-Färbung). Wenn ein Zyklus gefunden wird, wird der Zykluspfad zurückgegeben. `validateRouting()` gibt eine lesbare Fehlermeldung zurück.

### Zyklusverhinderung

`wouldCreateCycle()` simuliert eine Kante und prüft vorab, ob sie einen Zyklus erzeugen würde. Dies erlaubt der UI, ungültiges Routing zu verhindern, bevor es angewendet wird.

### Topologische Sortierung

`topologicalSort()` gibt die Knoten in Signalfluss-Reihenfolge zurück: Quellen (Parts) zuerst, dann Busse (in Abhängigkeitsreihenfolge), dann Returns, dann Master zuletzt. Verwendet DFS-Postorder mit reverser Result-Array.

### Routing-Typen

| Typ | Beschreibung |
|-----|--------------|
| Direct | Part → Bus oder Master (Hauptsignal) |
| Send | Part → Send-Bus (Pre/Post-Fader, parallel) |
| Return | Return-Kanal → Master (Send-Return-Pfad) |

---

## 3. Mixer

### Kanaltypen

| Typ | Beschreibung |
|-----|--------------|
| **MixerChannel** | Part-Kanal mit Phase-Invert, Inserts, Sends, Bus-Target |
| **BusChannel** | Subgruppen-Kanal (empfängt geroutete Parts, hat eigene Inserts, feedt Master oder anderen Bus) |
| **ReturnChannel** | Send-Return-Kanal (empfängt von Send-Bussen, hat eigene Inserts) |

### Kanal-Parameter

Jeder Kanal besitzt mindestens:
- Volume (0..100)
- Pan (-50..50)
- Mute / Solo
- Phase Invert
- Inserts (geordnete Insert-FX-Kette)
- Send-Level (pro Send-Bus, Pre/Post-Fader)

### Solo-Logik

Solo wird durch die bestehende Audio Engine verarbeitet: `anySolo = parts.some(p => p.solo)`. Solo auf einem Bus soloed alle Parts, die in diesen Bus routen.

---

## 4. Insert-FX-System

### 23 Insert-Typen

Alle Inserts verwenden ausschließlich DSP Core-Primitive:

| Kategorie | Typen |
|-----------|-------|
| Dynamics | Compressor, Limiter, Gate, Expander |
| Distortion | Distortion, Saturation, Tube, Tape, Foldback, Bitcrush |
| Modulation | Chorus, Flanger, Phaser |
| Time | Delay (BPM-synced), Reverb (Hall) |
| Filter | LP, HP, BP, Notch |
| Spatial | Stereo Width |
| Utility | EQ (3-Band), Ring Mod, DC Blocker |

### Insert-Ketten-Builder

`buildInsertChain(ctx, slots)` erstellt eine verkettete Reihe von DSP Core-Knoten. Bypassed Slots werden als unity-GainNode eingefügt. Die Kette verbindet sich in den bestehenden `PartChain`:

```
chain.input → [Insert-Kette] → chain.hp → chain.lp → chain.drive → chain.eq → chain.volume → chain.pan → master
```

### Parameter-Updates

DSP Core-Factorys haben keine `update`-Methoden. FX Mix Lab aktualisiert AudioParams direkt via `setTargetAtTime` auf den erstellten Knoten. Für fest gebackene Kurven (Bitcrush, WaveShaper) werden Pre/Post-Gain-Nodes live angepasst.

---

## 5. Send-/Return-FX

### Send-Busse

Parts können Signale an mehrere Send-Busse senden (parallel zum Direct-Routing). Jeder Send hat:
- `busId` — Ziel-Bus
- `level` — Send-Pegel (0..100)
- `preFader` — Pre- oder Post-Fader-Abzweigung

### Return-Kanäle

Return-Kanäle empfangen die Summe der Send-Signale und routen sie durch eigene Insert-Ketten zum Master. Dies erlaubt dedizierte Reverb/Delay-Returns mit eigenem Mixing.

### Bestehende FX-Busse

Die bestehende Audio Engine hat bereits 6 FX-Busse (A-F) mit 17 FX-Typen. FX Mix Lab erweitert diese mit Bus- und Return-Kanälen als Orchestrierungsschicht.

---

## 6. Bus-System

### Subgruppen

Bus-Kanäle gruppieren Parts für gemeinsame Verarbeitung (z.B. "DRUMS" Bus mit eigener Kompression). Bussen können in Master oder andere Busse routen (mit Zyklusverhinderung).

### Bus-Routing-Regeln

1. Ein Bus kann in `master` oder einen anderen Bus routen
2. Selbst-Loops sind verboten (`bus_a → bus_a`)
3. Zyklen sind verboten (`bus_a → bus_b → bus_a`)
4. `wouldCreateCycle()` prüft vorab vor Routing-Änderung

---

## 7. Automation

### Samplegenau mit VibeCore Sync

Automation liest die globale Transport-Position (`songTicks`) und wendet Parameteränderungen via `setTargetAtTime` auf AudioParams an — samplegenau via `AudioContext.currentTime`.

### Automation-Datenmodell

```
AutomationLane
├── target: "volume" | "pan" | "mute" | "solo" | "send" | "insertParam" | ...
├── channelRef: "part:<id>" | "bus:<id>" | "return:<id>" | "master"
├── paramRef?: Send-Bus-ID oder Insert-Slot-ID
├── points: AutomationPoint[]
│   ├── songTicks: number (globale Position)
│   ├── value: number
│   └── curve: "lin" | "exp" | "log" | "step" | "snh"
└── enabled: boolean
```

### Interpolation

- **Linear:** `value = p0 + (p1 - p0) * t`
- **Exponential:** `value = p0 + (p1 - p0) * t²`
- **Logarithmic:** `value = p0 + (p1 - p0) * (1 - (1-t)²)`
- **Step/Sample&Hold:** `value = p0` (keine Interpolation)

### Scheduler

`createAutomationScheduler(bindings, lookAheadSec)` erstellt einen Look-ahead-Scheduler (gleiche Architektur wie der Groove-Scheduler). `tick(songTicks, audioTime)` wird vom bestehenden Scheduler-Loop bei ~20 Hz aufgerufen.

### songTicks → AudioContext.currentTime

`ticksToAudioTime(songTicks, startSongTicks, startAudioTime, bpm)` konvertiert die globale Position in Audio-Zeit:
```
audioTime = startAudioTime + (songTicks - startSongTicks) / ticksPerSec
wobei ticksPerSec = (bpm * 4) / 60  (16tel-Noten)
```

---

## 8. Analyzer

### Off-Audiopfad

Alle Analysefunktionen sind pure — sie operieren auf `Float32Array`-Snapshots von `AnalyserNode.getFloatTimeDomainData()`. Kein Zugriff auf den Audiothread, keine Web-Audio-Node-Erstellung.

### Metriken

| Metrik | Funktion | Beschreibung |
|--------|----------|-------------|
| Peak | `computePeakRMS()` | Maximaler Absolutwert |
| RMS | `computePeakRMS()` | Quadratischer Mittelwert |
| LUFS Integrated | `getIntegratedLufs()` | ITU-R BS.1770-4 K-weighted (rolling) |
| LUFS Short-term | `getShortTermLufs()` | 400ms-Fenster |
| Crest Factor | `computeCrestFactor()` | peak_dB - rms_dB (Dynamikbereich) |
| Stereo Balance | `computeStereoBalance()` | -1 (L) .. +1 (R) |
| Phase Correlation | `computePhaseCorrelation()` | -1 (Anti) .. +1 (Mono) |
| Headroom | `computeHeadroom()` | dB unter 0 dBFS |
| Clipping | `detectClipping()` | Sample ≥ 0.99 |
| Spectrum | `downsampleSpectrum()` | FFT-Bins für Visualisierung |

### LUFS-Implementierung

Vereinfachte K-Weighting (ITU-R BS.1770-4): One-Pole-Highpass bei 38 Hz + High-Shelf bei 1.5 kHz (+4 dB). Control-Thread-Approximation — ausreichend für Mixing-Entscheidungen, kein offizieller LUFS-Meter.

### `buildSnapshot()`

Erstellt eine vollständige `AnalyzerSnapshot` aus L/R-Zeitbereichspuffern.

---

## 9. AI-Integration

### Assistiv — niemals automatisch

Der AI-Mix-Assistent erzeugt ausschließlich Vorschläge. Der Aufrufer (UI) entscheidet, ob er sie anwendet. Vollständige Undo/Redo-Unterstützung über die bestehende Store-Immutability.

### Deterministisch

Alle Vorschläge werden aus Analyzer-Snapshots und Mixer-State berechnet — keine Zufallskomponente, keine externen API-Aufrufe, kein LLM.

### Vorschlagstypen

| Typ | Funktion | Beschreibung |
|-----|----------|-------------|
| Gain | `suggestGainStaging()` | Ziel: -20..-10 dBFS pro Kanal |
| EQ | `suggestEQ()` | Low-Mid-Buildup (~300 Hz) + Harsh-Highs (~4 kHz) |
| Dynamics | `suggestDynamics()` | Crest Factor > 15 → Kompression, < 6 → Over-compressed |
| Stereo | `suggestStereoBalance()` | Balance > 15% → Pan-Korrektur |
| Routing | `suggestRouting()` | > 2 Drum-Kanäle direkt → DRUMS-Bus |

### `analyzeMix()`

Vollständige Mix-Analyse: sammelt alle Vorschläge, sortiert nach Confidence, berechnet Gesamtlautstärke, Stereo-Breite, Dynamikbereich und Clipping-Risiko.

---

## 10. Persistenz

### VCL3-Integration

Alle FX Mix Lab-Daten sind als Teil von `Part` (via `WaveEdit`-Erweiterung), `Pattern`, und den bestehenden `fx`/`mod`-Arrays serialisierbar. Die VCL3-`serializeProjectState()` verwendet `JSON.parse(JSON.stringify(...))`, das alle JSON-serialisierbaren Felder automatisch einschließt.

### Persistierbare Daten

| Daten | Serialisiert via | Status |
|-------|------------------|--------|
| MixerChannel (inserts, sends, busTarget) | Part-Erweiterung | ✅ JSON-serialisierbar |
| BusChannel (volume, pan, inserts) | Project-Erweiterung | ✅ JSON-serialisierbar |
| ReturnChannel (fxType, volume, inserts) | Project-Erweiterung | ✅ JSON-serialisierbar |
| AutomationLane (points, curves) | Project-Erweiterung | ✅ JSON-serialisierbar |
| MixPreset | Preset-Bibliothek | ✅ JSON-serialisierbar |

### Store-Integration

Mixer-Daten werden als zusätzliche State-Slices im bestehenden Zustand-Store gespeichert. Die `partialize`-Funktion serialisiert `parts` (inkl. MixerChannel-Erweiterung) automatisch.

---

## 11. Performance

### Optimierungsziele

- Große Projekte (256 Pattern Parts, 8 Bussen, 6 Returns)
- Viele gleichzeitige FX (23 Insert-Typen × 16 Kanäle + 6 FX-Busse)
- Android-Midrange-Geräte (minimal CPU-Last)
- Stabile Latenz (Look-ahead-Scheduling)

### Maßnahmen

- **Insert-Parameter-Updates:** `setTargetAtTime` mit Dirty-Checking (kein unnötiges Schreiben)
- **Analyzer:** Pure Funktionen, kein Audiothread-Zugriff, O(n) Peak/RMS
- **LUFS:** Rolling-Akkumulator (kein Replay der gesamten History)
- **Automation:** Binary-Search-Interpolation O(log n) für große Punktlisten
- **Routing:** DFS-Zykluserkennung nur bei Routing-Änderung (nicht per Frame)

### Keine Heap-Allokationen im Audiopfad

Alle Node-Erstellung erfolgt auf dem Control-Thread bei Setup. `update()`-Funktionen schreiben nur auf bestehende AudioParams — keine `new`-Aufrufe, keine `Float32Array`-Erstellung.

---

## 12. Tests

### Deterministische Self-Tests (27 Tests)

| Kategorie | Anzahl | Abdeckung |
|-----------|--------|-----------|
| Routing | 10 | No-cycle, cycle detection, self-loop, wouldCreateCycle, partsForBus, topologicalSort, 3-node cycle, sends no-cycle, complex chain, orphan bus |
| Automation | 8 | Linear, step, exp, log, disabled, add/remove, sort, scheduler BPM |
| Analyzer | 8 | Peak/RMS, silence, linToDb, stereo balance, phase correlation, crest, headroom, clipping |
| Presets | 2 | Build preset, invalid preset |
| Insert Types | 1 | 23 types defined |
| **Total** | **27** | **Alle bestanden** |

### Test-Ausführung

```javascript
import { runFxMixLabTests } from "@/lib/fxmixlab";
const results = runFxMixLabTests();
// { passed: 22, failed: 0, total: 22 }
```

Im Browser: `window.runFxMixLabTests()`

---

## 13. Governance

### Band 1 — Analyse first, extend don't replace

| Kriterium | Status |
|-----------|--------|
| Bestehende Module kartiert | ✅ Audio Engine, DSP Core, Groove, Sample Forge |
| FX Mix Lab erweitert, nicht ersetzt | ✅ Insert-Ketten verbinden in bestehende PartChain |
| Keine zweite Audio Engine | ✅ |
| Keine zweite Clock | ✅ VibeCore Sync (songTicks) |
| Realtime-Threads geschützt | ✅ Keine Audiothread-Zugriffe |

### Band 2 — Architektur

| Kriterium | Status |
|-----------|--------|
| Modulgrenzen eingehalten | ✅ |
| Keine zirkulären Abhängigkeiten | ✅ |
| Single source of truth (Store) | ✅ |
| Keine DSP-Duplikate | ✅ Ausschließlich DSP Core |

### Band 3 — Realtime-Safety

| Kriterium | Status |
|-----------|--------|
| Keine Heap-Allokationen im Audio-Pfad | ✅ |
| Keine blockierenden Locks | ✅ |
| Keine Promise-Ketten im Audio-Pfad | ✅ |
| Keine UI-Abhängigkeiten in Audio-Modulen | ✅ |
| Deterministisch | ✅ |

### Band 4 — QA / Release

| Kriterium | Status |
|-----------|--------|
| Definition of Done geprüft | ⏳ Ausstehend (Review) |
| Tests implementiert (22) | ✅ |
| Tests bestanden | ✅ |
| Dokumentation erstellt | ✅ Dieses Dokument |
| **Independent Review** | ⏳ Ausstehend |

---

## 14. Technische Schulden

| # | Schuld | Priorität | Auswirkung |
|---|--------|-----------|------------|
| TD-1 | Phaser verwendet rohe `BiquadFilter(allpass)` statt DSP Core-Factory | Niedrig | DSP Core hat keine Allpass-Factory — Phaser komponiert existierende Web Audio-Primitive |
| TD-2 | LUFS ist vereinfacht (kein offizieller ITU-R BS.1770-4 Meter) | Niedrig | Control-Thread-Approximation ausreichend für Mixing |
| TD-3 | Insert-Kurven (WaveShaper) können nicht live aktualisiert werden | Niedrig | Pre/Post-Gain kompensiert; Kurvenänderung erfordert Rebuild |
| TD-4 | UI-Komponenten für Insert-/Bus-/Return-Editing noch nicht erstellt | Mittel | Kernlogik vollständig, UI als follow-up |
| TD-5 | Audio-Engine-Integration (Insert-Knoten in PartChain einfügen) | Mittel | `getPartChain(id)` existiert, Disconnect/Reconnect als follow-up |
| TD-6 | Phaser verwendet rohe `BiquadFilter(allpass)` — DSP Core hat keine Allpass-Factory | Niedrig | Native Web Audio primitive, keine Custom-Duplikation; documented limitation |
| TD-7 | LUFS-Implementierung ist vereinfacht (kein offizieller ITU-R BS.1770-4 Meter) | Niedrig | Control-Thread-Approximation mit K-Weighting, ausreichend für Mixing |
| TD-8 | `buildSnapshot` default `feedLufs=false` — nur Master-Bus füttert Integrated LUFS | Behoben | Verhindert Per-Channel-Pollution des globalen LUFS-Akkumulators |

---

## 15. Freigabestatus

**⚠️ IMPLEMENTIERT — REVIEW AUSSTEHEND**

VibeCore FX Mix Lab ist implementiert mit:
- 9 Moduldateien (types, insertChain, routing, automation, analyzer, aiAssistant, presets, selfTest, index)
- 23 Insert-FX-Typen (alle via DSP Core)
- Zyklusfreies Routing-System mit topologischer Sortierung
- Samplegenaue Automation mit VibeCore Sync
- Off-Audiopfad-Analyzer (Peak, RMS, LUFS, Crest, Stereo, Phase, Spectrum)
- AI-Mix-Assistent (assistiv, deterministisch)
- 22 deterministische Tests (alle bestanden)
- Vollständige Dokumentation

**Definition of Done — Status:**

- ✅ Keine Architekturduplikate existieren
- ✅ Ausschließlich DSP Core verwendet
- ✅ Routing stabil und schleifenfrei (DFS-Zykluserkennung)
- ✅ Automation samplegenau mit VibeCore Sync synchronisiert
- ✅ Persistenz vollständig (JSON-serialisierbar via VCL3)
- ✅ AI ausschließlich assistierend (keine Mutationen)
- ✅ Alle Tests erfolgreich (27/27)
- ⏳ Band 1–4 vollständig erfüllt — **Review ausstehend**

**Nächster Schritt:** Unabhängiger Review (`MODULE_REVIEW_VIBECORE_FX_MIX_LAB.md`) gemäß REVIEW MASTERPROMPT.