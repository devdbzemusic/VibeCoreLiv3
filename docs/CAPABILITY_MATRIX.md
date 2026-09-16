# VibeCoreLiv3 — Capability Matrix

Stand: 2026-09-16

Status values follow the v4.0 MasterPrompt where applicable.

| Capability | Current Evidence | Status | Revision Action |
|---|---|---|---|
| Master musical clock | `src/lib/clock/masterClock.ts` | STATICALLY VERIFIED | prove repo-wide single-clock ownership and explicit tick-unit conversions |
| Central app state | `src/lib/store.ts` | STATICALLY VERIFIED | split concerns via typed slices/contracts, not parallel stores |
| Parameter Hub | `src/lib/runtime/parameterHub.ts` is a stateless typed proxy over the existing Zustand authority | PARTIAL / STATICALLY VERIFIED | expand coverage; add gesture/undo/automation semantics without creating parallel state |
| Capability Registry | `src/lib/capabilities/registry.ts` static metadata + side-effect-free runtime probes | STATICALLY VERIFIED | continue migrating UI/runtime availability checks to registry |
| Runtime selection | `src/lib/runtime/selection.ts` now queries `audio.native` through Capability Registry | STATICALLY VERIFIED | keep activation/failure separate from selection |
| Web audio runtime | direct `engine.ts` WebAudio graph | STATICALLY VERIFIED | later normalize behind Runtime API / WebAudio adapter |
| Native Android backend | `AudioBackend` → `NativeOboeBackend` → `VibeCoreNative` | STATICALLY VERIFIED | device/runtime proof still required |
| Android WebView injection | `MainActivity.kt` injects `window.VibeCoreNative` | STATICALLY VERIFIED | verify packaged APK/runtime |
| Native Oboe callback | `VibeCoreAudioEngine::onAudioReady()` | STATICALLY VERIFIED | measure callback behavior/xRuns/latency on device |
| Native low-latency capability | Registry reports the Native Oboe path as available when bridge exists, but does not claim measured latency | NOT EXECUTED | execute latency/xRun/device measurements |
| Native sync | `VibeCoreSync` PPQ 1920 | STATICALLY VERIFIED | prove no competing runtime timing source on device |
| Browser scheduler | `scheduler.ts` AudioContext-time look-ahead | STATICALLY VERIFIED | classify as browser-only musical scheduler; preserve native gate |
| Native/browser scheduler exclusion | `isNativeAudioPath()` gate in scheduler + startup binding in `Index.tsx` | STATICALLY VERIFIED | execute duplicate-trigger tests on Android |
| Groove/Sequencer browser | scheduler → `scheduleTickAt()` → `triggerPart()` | STATICALLY VERIFIED | timing/E2E verification |
| Groove native engine | `GrooveNode` + `StepSequencer` + TriggerQueue | STATICALLY VERIFIED | prove web project-state mirroring into native GrooveEngine |
| Groove state mirror to native | Current-scene ProjectMirror exists; Kotlin/JNI begin/end project-load marshalling remains incomplete | PARTIAL | finish bulk-load bridge, bind after native activation, execute state parity tests |
| Piano Roll | UI/domain/native code present | STATICALLY VERIFIED | verify state mirroring/native playback |
| Arpeggiator | browser implementation/UI present | STATICALLY VERIFIED | prove native/runtime ownership story |
| 3D Synth browser | `triggerPart → trigger3DSynth → Synth3D voiceEngine` plus registration acknowledgement | STATICALLY VERIFIED | execute rapid-tap/polyphony/audio tests |
| 3D Synth native | Capability Registry explicitly reports unavailable; no dedicated native renderer/JNI lifecycle proven | UNSUPPORTED / GAP | design/implement native renderer before exposing capability |
| 3D Bass browser | WebAudio voice engine + explicit release through existing voice `steal(releaseSec)` path | STATICALLY VERIFIED | execute keyboard/rapid-release tests |
| 3D Bass native | Registry checks `bassNoteOn/off/allNotesOff` bridge availability | STATICALLY VERIFIED | execute device proof |
| Shared InstrumentKeyboard | UI routes through Runtime PerformanceInput; pointer async lifecycle guarded | STATICALLY VERIFIED | execute multi-touch/cancel/unmount/background tests |
| Runtime Preview browser | `RuntimePreview` delegates to existing WebAudio preview path | STATICALLY VERIFIED | migrate remaining preview callers |
| Runtime Preview native | Registry explicitly reports unavailable; no reserved preview buffer/slot contract | UNSUPPORTED / GAP | add dedicated native preview contract; do not steal Voice slots |
| Sample editing | wave/slice/grain/stretch domains present | STATICALLY VERIFIED | enforce sample-only semantic boundary |
| Sample/Synth boundary | legacy `sample/synth/hybrid` runtime branch still present | CONFLICT | migrate only after Gate B0 |
| FX/Mixer WebAudio | direct part/FX/master graph | STATICALLY VERIFIED | parameter-hub/runtime migration later |
| Voice native DSP | Kotlin → JNI → `VoiceEngine` → `VoiceNode` → DSP | STATICALLY VERIFIED | execute device evidence |
| Voice native live input | `voiceSetLiveInputEnabled` / `voiceLiveInputEnabled` bridge + `VoiceEngine::setLiveInputEnabled` | STATICALLY VERIFIED | request permission/device proof through RuntimeVoice UI flow |
| Voice UI semantics | Current VoiceTab is mainly generic Part editing and does not yet represent the Native Voice DSP contract | CONFLICT / PARTIAL | migrate only semantically exact controls first; keep generic Part controls distinct |
| Voice browser | generic WebAudio/Part behavior exists, but no equivalent dedicated Voice DSP contract is proven | PARTIAL / UNKNOWN | define explicit browser Voice semantics before claiming parity |
| bRAINWAVEz | WebAudio engine/UI/master-clock coupling | STATICALLY VERIFIED | parameter ownership + safety/perf tests |
| Remix pattern workflow | UI/chain/AI support | STATICALLY VERIFIED | integrate command boundary |
| Remix file analysis | import/analyze path | STATICALLY VERIFIED | adopt versioned AnalysisCache |
| Remix live input | incomplete evidence | PARTIAL / UNKNOWN | add capability-gated live-input contract |
| Device playback capture | no complete proven path | UNKNOWN | Android capability design + legal/platform gates |
| AI assistants | multiple deterministic assistants | STATICALLY VERIFIED | centralize intent boundary |
| AI learning consent | project-local consent/profile code | STATICALLY VERIFIED | version/revert/evidence hardening |
| AI Intent Layer | partial/direct apply paths remain | PARTIAL | implement intent/validation/command boundary |
| Motion Step Recorder | automation pieces exist; full contract not proven | PARTIAL / UNKNOWN | implement sync + parameter-hub recording path |
| MIDI input API | Runtime Registry can report Web MIDI API presence without requesting access | EXPECTED / NOT EXECUTED | bind actual MIDI ownership and timing through Runtime |
| External sync | clock source model exists | PARTIAL | verify MIDI/other sources individually |
| Resource cache core | deterministic byte-budgeted LRU/refcount cache exists | STATICALLY VERIFIED | integrate carefully into existing asset loaders |
| WebAudio sample cache | `engine.ts` still owns an unbounded `Map<SampleId, AudioBuffer>` | GAP | migrate to budgeted cache without replacing the 77 KB engine blindly |
| Analysis cache | version/hash/settings keyed analysis cache exists | STATICALLY VERIFIED CORE | adopt in Remix/Sample analysis callers |
| Waveform cache | no canonical peak-pyramid integration proven | GAP | add waveform peak cache and zoom pyramid later |
| Diagnostics | browser/native diagnostics facilities present | PARTIAL | expose Registry + cache/runtime metrics in one snapshot |
| Android touch E2E | detailed matrix exists | NOT EXECUTED | execute on target device |
| APK/native runtime | static call graph exists | NOT EXECUTED | build/install/launch and capture evidence |
| Audio latency/xRuns | instrumentation/API exists | NOT EXECUTED | measure and record |
| CPU/RAM/Jitter | no executed evidence | UNKNOWN / NOT EXECUTED | profile representative devices |
| Thermal/device matrix | required by v4 | NOT EXECUTED | profile representative Android devices |

## Runtime capability authority

The Capability Registry now owns side-effect-free environment/feature availability for migrated Runtime paths.

Current probe IDs include:

- `audio.web`
- `audio.native`
- `audio.lowLatency.native`
- `audio.input.web`
- `preview.buffer.web`
- `preview.buffer.native`
- `instrument.synth3d.web`
- `instrument.synth3d.native`
- `instrument.bass3d.web`
- `instrument.bass3d.native`
- `voice.native`
- `voice.liveInput.native`
- `midi.input.web`
- `storage.indexeddb`

A probe does not initialize audio, request permission, open MIDI or create a renderer. Availability is not equivalent to executed verification.

## Critical runtime-contract note

`AudioBackend` remains asymmetric: `NativeOboeBackend` implements the interface, while browser WebAudio still uses `engine.ts` directly instead of a concrete `WebAudioBackend`.

This is a documented architecture fact, not authorization to build another browser audio engine.

## Rule

The UI must not infer capability availability from local environment guesses once a path is migrated to the Registry. Unsupported capabilities are disabled/rejected with an explicit reason. Runtime activation and actual device proof remain separate evidence gates.
