# VibeCoreLiv3 — Capability Matrix

Stand: 2026-09-16

Status values follow the v4.0 MasterPrompt where applicable.

| Capability | Current Evidence | Status | Revision Action |
|---|---|---|---|
| Master musical clock | `src/lib/clock/masterClock.ts` | STATICALLY VERIFIED | prove repo-wide single-clock ownership |
| Central app state | `src/lib/store.ts` | STATICALLY VERIFIED | split concerns via typed slices/contracts, not parallel stores |
| Parameter Hub | no single authoritative implementation identified | GAP | implement central parameter contract |
| Capability Registry | no single authoritative registry identified | GAP | implement registry and backend/platform capability queries |
| Web audio runtime | multiple audio modules/backends | STATICALLY VERIFIED | route UI through Runtime API |
| Native Android audio | Kotlin/JNI/C++/Oboe path | STATICALLY VERIFIED | normalize behind Runtime API |
| Groove/Sequencer | UI/domain/native code present | STATICALLY VERIFIED | verify timing ownership and E2E |
| Piano Roll | UI/domain/native code present | STATICALLY VERIFIED | performance + gesture revision |
| Arpeggiator | implementation/UI present | STATICALLY VERIFIED | prove single sync ownership |
| 3D Synth | implementation/UI present | STATICALLY VERIFIED | route performance via input/runtime contracts |
| 3D Bass | implementation/UI/native support present | STATICALLY VERIFIED | route performance via input/runtime contracts |
| Sample editing | wave/slice/grain/stretch domains present | STATICALLY VERIFIED | enforce sample-only semantic boundary |
| Sample/Synth boundary | legacy `sample/synth/hybrid` model | CONFLICT | migrate to v4 instrument boundaries |
| FX/Mixer | modules and routing present | STATICALLY VERIFIED | performance/parameter-hub migration |
| Voice | module + native phase evidence | STATICALLY VERIFIED | runtime/E2E verification |
| bRAINWAVEz | WebAudio engine/UI/master-clock coupling | STATICALLY VERIFIED | move parameter ownership to hub; safety/perf tests |
| Remix pattern workflow | UI/chain/AI support | STATICALLY VERIFIED | integrate command boundary |
| Remix file analysis | import/analyze path | STATICALLY VERIFIED | analysis cache + UX polish |
| Remix live input | incomplete evidence | PARTIAL / UNKNOWN | add capability-gated live-input contract |
| Device playback capture | no complete proven path | UNKNOWN | Android capability design + legal/platform gates |
| AI assistants | multiple deterministic assistants | STATICALLY VERIFIED | centralize intent boundary |
| AI learning consent | project-local consent/profile code | STATICALLY VERIFIED | version/revert/evidence hardening |
| AI Intent Layer | partial/direct apply paths remain | PARTIAL | implement intent/validation/command boundary |
| Motion Step Recorder | automation pieces exist; full contract not proven | PARTIAL / UNKNOWN | implement sync + parameter-hub recording path |
| MIDI input | incomplete repo-wide proof in this revision | UNKNOWN | register capability + integration tests |
| External sync | clock source model exists | PARTIAL | verify MIDI/Link/other sources individually |
| Asset cache | no canonical cache subsystem identified | GAP | add cache service with budgets/invalidation |
| Waveform cache | no canonical cache subsystem identified | GAP | add peak pyramid cache |
| Analysis cache | no canonical shared cache identified | GAP | add hash/version keyed analysis cache |
| Diagnostics | multiple diagnostics facilities present | PARTIAL | unify runtime/perf/cache diagnostics |
| Android touch E2E | detailed matrix exists | NOT EXECUTED | execute on target device |
| Audio latency/xRuns | instrumentation intent exists | NOT EXECUTED | measure and record |
| Thermal/device matrix | required by v4 | NOT EXECUTED | profile representative Android devices |

## Rule

The UI must not infer a capability from environment guesses once the Capability Registry is introduced. Unsupported capabilities should be disabled/hidden with an explicit reason and fallback where possible.
