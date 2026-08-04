# VibeCore Univers — Architecture Freeze
## Executive Architecture Board — Phase 4 Sign-off

**Date:** 2026-08-04  
**Status:** FROZEN  
**Board:** Executive Platform Engineering  
**Authority:** Creative Master Workflow Senior SUPREMÉ Manager

---

## Architecture Freeze Checklist

| Question | Answer | Evidence |
|----------|--------|---------|
| Sind Modulgrenzen eindeutig? | **JA** | Jedes Modul hat genau einen Zuständigkeitsbereich (Sync, Graph, Groove). Keine Cross-Module-Direktzugriffe. |
| Existiert genau eine Audio Engine? | **JA** | `VibeCoreAudioEngine` — Singleton. Alle früheren Alternativen wurden in Phase 4 gelöscht. |
| Existiert genau eine Master Clock? | **JA** | `VibeCoreSync` — owned by `VibeCoreAudioEngine`. Kein Modul hat eine eigene Uhr. |
| Sind alle Datenflüsse dokumentiert? | **JA** | Vollständig in ADR-001..006 + Architekturdiagramm unten. |
| Sind alle Queues dokumentiert? | **JA** | Drei Queues: SyncCommand, GrooveCommand, AudioCommand — alle `AudioThreadSafeQueue<T, N>`. |
| Ist jede Speicher-Ownership eindeutig? | **JA** | `AudioGraphManager` owns nodes; `VoicePool` owns voices; `SampleBuffer` data ist extern read-only. |
| Gibt es zirkuläre Abhängigkeiten? | **NEIN** | DAG durch `AudioGraphManager::rebuildRenderOrder()` erzwungen. |
| Ist jede JNI-Schnittstelle dokumentiert? | **JA** | `bridge/jni_bridge.cpp` — 50+ JNI-Funktionen; `NativeAudioBridge.kt` — vollständig dokumentiert. |
| Ist die Architektur für Synth, Bass, Voice, FX vorbereitet? | **JA** | Alle neuen Instrumente implementieren `AudioNode`, registrieren sich im Graph, empfangen TickEvents. |

---

## Architekturdiagramm (eingefroren)

```
┌────────────────────────────────────────────────────────────────────────────────┐
│  JavaScript / Kotlin UI Layer                                                  │
│  (WebView @JavascriptInterface / direct Kotlin)                               │
└──────────────────────────────────┬─────────────────────────────────────────────┘
                                   │ NativeAudioBridge.kt
                                   │ jni_bridge.cpp (marshalling ONLY)
                                   ▼
┌────────────────────────────────────────────────────────────────────────────────┐
│  VibeCoreAudioEngine  (ONE instance, UI Thread API)                           │
│                                                                                │
│  ┌──────────────────┐  ┌────────────────────┐  ┌───────────────────────────┐  │
│  │ AudioDeviceManager│  │ AudioSessionManager│  │    PerformanceMonitor     │  │
│  └──────────────────┘  └────────────────────┘  └───────────────────────────┘  │
│                                                                                │
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │  VibeCoreSync  (ONE global clock, PPQ=1920)                              │  │
│  │  Transport · Tempo · Timeline · Loop · Scheduler                         │  │
│  │  SyncCommand Queue ←── setTempo() / play() / stop() (UI Thread)         │  │
│  └──────────────────────────────────┬───────────────────────────────────────┘  │
│                                     │ TickEventBuffer (stack, ≤64 events/cb)   │
│                                     ▼                                          │
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │  AudioGraphManager  (DAG, Kahn topological sort)                         │  │
│  │  dispatchSyncEvents() → process()                                        │  │
│  │                                                                           │  │
│  │  ┌─────────────────────────────────────────────────────────────────────┐ │  │
│  │  │  GrooveNode : AudioNode  (Phase 3)                                  │ │  │
│  │  │  GrooveCommand Queue ←── GrooveEngine (UI Thread)                   │ │  │
│  │  │  16× StepSequencer · 16× PianoRoll · VoicePool(64) · SceneEngine   │ │  │
│  │  │  TriggerQueue (256) · onTick/onBeat/onBar/onLoop/onTempoChanged     │ │  │
│  │  └─────────────────────────────────────────────────────────────────────┘ │  │
│  │                                                                           │  │
│  │  ┌──────────────┐   (Phase 5+: BassNode, SynthNode, VoiceNode, FXNode)  │  │
│  │  │  MixerNode   │ ◄──── all nodes mix here                              │  │
│  │  └──────────────┘                                                        │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
│                                     │ Oboe output buffer                       │
└─────────────────────────────────────┼──────────────────────────────────────────┘
                                      ▼
                              Audio Hardware (AAudio / OpenSL ES)
```

---

## Thread-Diagramm

```
Thread            Ownership & Responsibilities
─────────────────────────────────────────────────────────────────────────────
UI Thread         VibeCoreAudioEngine API · GrooveEngine API · NativeAudioBridge
                  Writes to: SyncCommand queue, GrooveCommand queue, AudioCommand queue
                  Reads from: atomic approximations (isPlaying, currentTick, voiceCount)
                  NEVER touches: mAT state in VibeCoreSync, mTracks in GrooveNode

Audio Thread      Oboe::onAudioReady() — exclusive hot path
                  Drains: SyncCommand queue, GrooveCommand queue, AudioCommand queue
                  Writes: mAT (VibeCoreSync), mTracks (GrooveNode), VoicePool voices
                  NEVER: malloc · free · mutex · logging · JNI · file I/O

Worker Thread     File I/O, sample loading (SampleBuffer::data is read-only once loaded)
                  Writes: SampleBuffer registry via VoicePool::registerSample() — before stream

File I/O Thread   Asset loading only. Completes before engine start.

MIDI Thread       (Phase 5+) — writes to SyncCommand queue (lock-free, same as UI Thread)
```

---

## Queue-System (vollständig dokumentiert)

| Queue | Type | Capacity | Producer | Consumer | Payload |
|-------|------|----------|---------|---------|---------|
| `SyncCommand` | SPSC | 128 | UI/MIDI Thread | Audio Thread (VibeCoreSync) | SetTempo, Transport, Loop, Position |
| `GrooveCommand` | SPSC | 256 | UI Thread (GrooveEngine) | Audio Thread (GrooveNode) | 35 command types |
| `AudioCommand` | SPSC | 128 | UI Thread | Audio Thread (VibeCoreAudioEngine) | SetMasterGain |
| `TriggerQueue` | Sequential | 256 | Audio Thread onTick() | Audio Thread process() | Trigger (per-callback) |

All queues: `AudioThreadSafeQueue<T, N>` — lock-free SPSC, T must be trivially copyable, N must be power of 2.

---

## Modulübersicht

| Modul | Files | Phase | Abhängigkeiten |
|-------|-------|-------|---------------|
| Platform | `platform/VibeCoreAudioEngine` | 1 | Oboe, AudioDeviceMgr, SessionMgr, PerfMon |
| Device Mgr | `platform/AudioDeviceManager` | 1 | Oboe |
| Session Mgr | `platform/AudioSessionManager` | 1 | — |
| Perf Mon | `platform/PerformanceMonitor` | 1 | — |
| Diagnostics | `platform/Diagnostics` | 1 | PerfMon, DeviceMgr, SessionMgr |
| Logging | `platform/VibeCoreLog.h` | 1 | android/log.h |
| AudioNode | `graph/AudioNode.h` | 1+2 | MusicalPosition |
| AudioBus | `graph/AudioBus.h` | 1 | — |
| AudioGraphManager | `graph/AudioGraphManager` | 1+2 | AudioNode, AudioBus, TickEvent |
| MixerNode | `graph/MixerNode` | 1 | AudioNode |
| ThreadModel | `threads/ThreadModel` | 1 | — |
| Queue | `threads/AudioThreadSafeQueue.h` | 1 | — |
| MusicalPosition | `platform/sync/MusicalPosition.h` | 2 | — |
| TickEvent | `platform/sync/TickEvent.h` | 2 | MusicalPosition |
| SyncCommand | `platform/sync/SyncCommand.h` | 2 | — |
| VibeCoreSync | `platform/sync/VibeCoreSync` | 2 | MusicalPosition, TickEvent, SyncCommand, Queue |
| GrooveTypes | `groove/GrooveTypes.h` | 3 | — |
| GrooveCommands | `groove/GrooveCommands.h` | 3 | GrooveTypes |
| TriggerQueue | `groove/TriggerQueue.h` | 3 | GrooveTypes |
| VoicePool | `groove/VoicePool` | 3 | GrooveTypes |
| StepSequencer | `groove/StepSequencer` | 3 | GrooveTypes, TriggerQueue |
| PianoRoll | `groove/PianoRoll` | 3 | GrooveTypes, TriggerQueue |
| SceneEngine | `groove/SceneEngine` | 3 | GrooveTypes |
| GrooveNode | `groove/GrooveNode` | 3 | AudioNode, Sync headers, all Groove |
| GrooveEngine | `groove/GrooveEngine` | 3+4 | GrooveNode, GrooveTypes |
| JNI Bridge | `bridge/jni_bridge.cpp` | 1–3 | VibeCoreAudioEngine, GrooveEngine |
| Kotlin Bridge | `NativeAudioBridge.kt` | 1–3 | JNI Bridge |

---

## Speicher-Ownership

```
VibeCoreAudioEngine
  owns:  AudioDeviceManager (member)
  owns:  AudioSessionManager (member)
  owns:  PerformanceMonitor (member)
  owns:  VibeCoreSync (unique_ptr)
  owns:  AudioGraphManager (unique_ptr)
  owns:  Diagnostics (unique_ptr)

AudioGraphManager
  owns:  vector<unique_ptr<AudioNode>>  — all nodes
  owns:  AudioBus per node             — pre-allocated output buses

GrooveNode : AudioNode
  owns:  Track[16]       — audio thread state (patterns, banks)
  owns:  StepSequencer[16]
  owns:  PianoRoll[16]
  owns:  VoicePool
  owns:  TriggerQueue
  owns:  SceneEngine

GrooveEngine (UI Thread)
  holds: GrooveNode& reference (NOT owned — owned by AudioGraphManager)
  owns:  UITrack[16]     — UI mirror copy
  owns:  UndoStack       — 64 PatternSnapshot ring
  owns:  Pattern clipboard

SampleBuffer
  data: const float* — pointer to external PCM data
  owned by: caller (e.g. file loader); GrooveNode only holds a const pointer
```

---

## API-Übersicht (öffentliche Interfaces — eingefroren)

### VibeCoreAudioEngine (UI Thread)
```cpp
bool   start() / void stop() / bool isRunning()
void   transportPlay() / transportStop() / bool transportIsPlaying()
void   setTempo(double) / double currentBpm()
void   setTimeSignature(int, int)
void   setLoopEnabled(bool) / setLoopPoints(int64, int64)
void   setPosition(int64) / int64 currentTick()
MusicalPosition currentPosition()
void   setMasterGain(float)
void   onDeviceChange() / onAudioFocusGained() / onAudioFocusLost(bool)
double estimatedLatencyMs()
string diagnosticStatusLine()
AudioGraphManager& graph() / VibeCoreSync& sync()
```

### GrooveEngine (UI Thread)
```cpp
void   setStep(t, s, active, vel, note) + 8 step property setters
void   setPatternLength(t, steps) / setSwing(t) / setHumanize(t) / clearPattern(t)
void   copyPattern(t) / pastePattern(t) / bool hasClipboard()
bool   undo() / redo() / canUndo() / canRedo() / clearUndoHistory()
void   setTrackMute/Solo/Volume/Sample/Mode(t, ...)
void   queueSceneChange(scene)
void   addPianoRollNote/removePianoRollNote/clearPianoRoll(t, ...)
void   registerSample(id, SampleBuffer&)
const UITrack& uiTrack(t) / uiActivePattern(t) / uiStep(t, s)
int32  activeVoiceCount() / currentStep(t) / activeScene() / bool isPlaying()
```

### NativeAudioBridge.kt (@JavascriptInterface — WebView)
All VibeCoreAudioEngine + GrooveEngine methods exposed as `@JavascriptInterface`.  
JNI naming: `Java_com_vibecore_audio_NativeAudioBridge_<method>`.

---

## Vorbereitung für Phase 5+

Jedes neue Instrument (Bass, Synth, Voice, FX) folgt diesem Muster:

```cpp
class BassNode : public AudioNode {
public:
    BassNode(NodeId id);
    void prepare(int sampleRate, int maxFrames) override;
    void reset()                                 override;
    void process(const float*, float*, int, int) noexcept override;

    // Nur implementieren was benötigt wird:
    void onTick(int64_t, const MusicalPosition&, int32_t) noexcept override;
    void onTempoChanged(double, int32_t)                  noexcept override;
};

// Registrierung:
auto bassId = engine.graph().addNode(std::make_unique<BassNode>(2));
engine.graph().connect(bassId, mixerId);
```

Kein eigener Clock. Kein eigener Scheduler. Keine neuen Queue-Typen nötig.

---

*Architecture Freeze — Phase 4 — VibeCore Univers SUPREMÉ*  
*Executive Architecture Board · 2026-08-04*
