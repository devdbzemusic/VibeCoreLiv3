# VibeCoreLiv3 — Capability Matrix

Stand: 2026-09-16

Status values follow the v4.0 MasterPrompt where applicable.

| Capability | Current Evidence | Status | Revision Action |
|---|---|---|---|
| Master musical clock | `src/lib/clock/masterClock.ts` | STATICALLY VERIFIED | prove repo-wide single-clock ownership and explicit tick-unit conversions |
| Central app state | `src/lib/store.ts` | STATICALLY VERIFIED | split concerns via typed slices/contracts, not parallel stores |
| Parameter Hub | store/module setters exist; dedicated authoritative hub not proven | PARTIAL / GAP | implement/centralize typed parameter contract after Gate B0 |
| Capability Registry | `src/lib/capabilities/registry.ts` | STATICALLY VERIFIED | harden adoption; UI/runtime must use it as sole availability authority |
| Web audio runtime | direct `engine.ts` WebAudio graph | STATICALLY VERIFIED | later normalize behind Runtime API / WebAudio adapter |
| Native Android backend | `AudioBackend` → `NativeOboeBackend` → `VibeCoreNative` | STATICALLY VERIFIED | device/runtime proof still required |
| Android WebView injection | `MainActivity.kt` injects `window.VibeCoreNative` | STATICALLY VERIFIED | verify packaged APK/runtime |
| Native Oboe callback | `VibeCoreAudioEngine::onAudioReady()` | STATICALLY VERIFIED | measure callback behavior/xRuns/latency on device |
| Native sync | `VibeCoreSync` PPQ 1920 | STATICALLY VERIFIED | prove no competing runtime timing source on device |
| Browser scheduler | `scheduler.ts` AudioContext-time look-ahead | STATICALLY VERIFIED | classify as browser-only musical scheduler; preserve native gate |
| Native/browser scheduler exclusion | `isNativeAudioPath()` gate in scheduler + startup binding in `Index.tsx` | STATICALLY VERIFIED | execute duplicate-trigger tests on Android |
| Groove/Sequencer browser | scheduler → `scheduleTickAt()` → `triggerPart()` | STATICALLY VERIFIED | timing/E2E verification |
| Groove native engine | `GrooveNode` + `StepSequencer` + TriggerQueue | STATICALLY VERIFIED | prove web project-state mirroring into native GrooveEngine |
| Groove state mirror to native | Kotlin exposes `groove*`; exact TS caller chain not yet proven | UNKNOWN | release-blocking call-graph proof |
| Piano Roll | UI/domain/native code present | STATICALLY VERIFIED | verify state mirroring/native playback |
| Arpeggiator | browser implementation/UI present | STATICALLY VERIFIED | prove native/runtime ownership story |
| 3D Synth | browser implementation/UI present | STATICALLY VERIFIED | route performance via explicit runtime contract later |
| 3D Bass | browser + native support present | STATICALLY VERIFIED | correlate browser/native authority and tests |
| Sample editing | wave/slice/grain/stretch domains present | STATICALLY VERIFIED | enforce sample-only semantic boundary |
| Sample/Synth boundary | legacy `sample/synth/hybrid` runtime branch still present | CONFLICT | migrate only after Gate B0 |
| FX/Mixer WebAudio | direct part/FX/master graph | STATICALLY VERIFIED | parameter-hub/runtime migration later |
| Voice native | Kotlin → JNI → VoiceEngine → VoiceNode → DSP | STATICALLY VERIFIED | execute device evidence |
| Voice browser | direct WebAudio/3D/legacy trigger branches | STATICALLY VERIFIED | later normalize runtime contract |
| bRAINWAVEz | WebAudio engine/UI/master-clock coupling | STATICALLY VERIFIED | parameter ownership + safety/perf tests |
| Remix pattern workflow | UI/chain/AI support | STATICALLY VERIFIED | integrate command boundary |
| Remix file analysis | import/analyze path | STATICALLY VERIFIED | analysis cache + UX polish |
| Remix live input | incomplete evidence | PARTIAL / UNKNOWN | add capability-gated live-input contract |
| Device playback capture | no complete proven path | UNKNOWN | Android capability design + legal/platform gates |
| AI assistants | multiple deterministic assistants | STATICALLY VERIFIED | centralize intent boundary |
| AI learning consent | project-local consent/profile code | STATICALLY VERIFIED | version/revert/evidence hardening |
| AI Intent Layer | partial/direct apply paths remain | PARTIAL | implement intent/validation/command boundary |
| Motion Step Recorder | automation pieces exist; full contract not proven | PARTIAL / UNKNOWN | implement sync + parameter-hub recording path |
| MIDI input | implementation exists; full current runtime integration not yet re-audited | PARTIAL / UNKNOWN | timing/authority audit |
| External sync | clock source model exists | PARTIAL | verify MIDI/other sources individually |
| Asset cache | WebAudio sample cache/reverse cache exist, no canonical budgeted subsystem | PARTIAL | consolidate cache service with budgets/invalidation |
| Waveform cache | no canonical shared subsystem proven | GAP | add peak pyramid cache later |
| Analysis cache | no canonical shared cache proven | GAP | add hash/version keyed analysis cache later |
| Diagnostics | browser/native diagnostics facilities present | PARTIAL | unify runtime/perf/cache diagnostics |
| Android touch E2E | detailed matrix exists | NOT EXECUTED | execute on target device |
| APK/native runtime | static call graph exists | NOT EXECUTED | build/install/launch and capture evidence |
| Audio latency/xRuns | instrumentation/API exists | NOT EXECUTED | measure and record |
| CPU/RAM/Jitter | no executed evidence | UNKNOWN / NOT EXECUTED | profile representative devices |
| Thermal/device matrix | required by v4 | NOT EXECUTED | profile representative Android devices |

## Critical runtime-contract note

`AudioBackend` is currently asymmetric: `NativeOboeBackend` implements the interface, but browser WebAudio uses `engine.ts` directly instead of a concrete `WebAudioBackend`. This is a documented architecture fact, not yet authorization to refactor.

## Rule

The UI must not infer a capability from environment guesses once the Capability Registry is adopted as authoritative. Unsupported capabilities should be disabled/hidden with an explicit reason and fallback where possible.
