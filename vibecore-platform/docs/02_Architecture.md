# 02 — Architecture

> Phase/Doc 02 · Status: Draft v1.0 · Owner: Senior Software System Architect + Senior UI Architect · Review: 15-Rollen, 2/3-Mehrheit

## 1. Layer-Modell
Siehe `01_Blueprint.md`. Kommunikation zwischen Schichten ausschließlich über dokumentierte Schnittstellen; DSP-Core wird von Host/Project/SDK **nicht direkt** beeinflusst.

## 2. Datenflüsse
```
UI ──(Param-Snapshot)──► Audio-Thread ──(DSP-Graph)──► I/O
Audio-Thread ──(Meter-Snapshot, SPSC)──► UI
Host ──(Module-Loader)──► DSP-Graph
Project Runtime ──(Serialisierung)──► File-I/O-Thread (asynchron)
```
- **Control-Path** (UI→Audio): atomarer Snapshot, gelesen am Block-Anfang.
- **Signal-Path** (Audio→I/O): niemals blockiert, keine Allokation.
- **Feedback-Path** (Audio→UI): SPSC-Ringbuffer, UI pollt mit Bildrate.

## 3. Thread-Modell
| Thread | Priorität | Erlaubt | Verboten |
|---|---|---|---|
| **Audio** | RT-hoch | DSP-Block, Parameter-Read, Ringbuffer-Push | Locks, Heap, I/O, `std::function` |
| **UI** | normal | Rendering, Eingaben, Param-Snapshot-Write | Direkter DSP-Zugriff |
| **Worker** | normal | Sample-Analyse, Preset-Laden, Stem-Trennung | Audio-Synchronisation |
| **File-I/O** | niedrig | Lese-/Schreib-Queues asynchron | Audio-Thread blockieren |
| **Diagnostics** | niedrig | Metriken, Telemetrie (opt-in) | Audio-Pfad berühren |

## 4. Modul-Kompatibilität & ABI
- API-Version (ABI-stabil) vs. DSP-Version (Algorithmus ändert sich) vs. Modul-Version.
- Module deklarieren `api_version`, `dsp_version`, `module_version`; Host lehnt inkompatible Versionen kontrolliert ab.
- Baseline-Releases taggen alle Komponenten gemeinsam.

## 5. Services (System Architect)
- **Licensing-Server** (optional) — Modul- & Asset-Lizenzprüfung.
- **Asset-Cloud** (optional) — verteilte Preset-/Sample-Bibliothek.
- Beide sind **nicht** im kritischen Audio-Pfad; Kommunikation asynchron über Worker-Thread.

## 6. UI-Datenbindung
- Property-Baum (reaktiv): UI-Komponenten abonnieren Property-IDs; Runtime pusht Änderungen via Snapshot.
- Kein direkter Zugriff der UI auf Audio-Objekte — ausschließlich über dokumentierte Property-API (`19_API_Reference.md`).

## 7. Diagramme
- `diagrams/architecture/layer-model.mmd` — Schichten & Grenzen.
- `diagrams/runtime/thread-model.mmd` — Threads & Pfade.
- `diagrams/sync/clock-distribution.mmd` — Sync-Verteilung.
- Notation: Mermaid (`.mmd`) primär; PlantUML (`.puml`) für komplexe Sequenzdiagramme.