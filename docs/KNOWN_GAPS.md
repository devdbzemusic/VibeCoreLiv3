# VibeCoreLiv3 — Known Gaps

Stand: 2026-09-16

This file lists known gaps relative to the canonical v4.0 engineering specification.

## P0 — Architecture conflicts

### Sample/Synth instrument boundary
Current domain model still exposes legacy `sample | synth | hybrid` source modes across non-generic sample categories. This conflicts with v4.0 Sample-Slot Integrity.

Required:
- ADR
- migration contract
- data-model update
- UI update
- preset/serialization update
- AI/automation validation
- tests
- rollback/legacy import strategy

### Parameter Hub
No single authoritative parameter layer has been established repo-wide.

Required:
- typed parameter IDs
- set/get/subscribe contract
- gesture lifecycle
- automation write/read
- preset apply
- MIDI/AI integration
- runtime binding

### Capability Registry
No single authoritative runtime/platform capability registry has been established.

Required:
- typed capability IDs
- Web/Android/native providers
- availability/reason/fallback
- UI integration
- test coverage

## P1 — Runtime consolidation

### Backend access
Frontend modules still contain direct audio/engine access paths.

Required:
- Runtime API
- backend abstraction ownership
- UI migration
- bridge contract tests

### AI Intent boundary
Some assistant flows can apply domain/store changes without a single shared intent/validation/command boundary.

Required:
- Suggest/Preview/Apply/Revert/Explain contracts
- command validation
- undo/revert ownership

### Motion Step Recorder
Automation pieces exist, but the v4 end-to-end Motion Recorder capability is not yet proven.

Required:
- Master Sync timing
- Parameter Hub writes
- editability
- persistence
- undo/redo
- Synth/Bass integration

## P1 — Performance / caching

No canonical shared caching subsystem is currently documented for:

- decoded PCM
- resampled PCM
- waveform peak pyramids
- BPM/key/transient analysis
- AI context

Required:
- memory budgets
- invalidation/version keys
- LRU/ref-count strategy where appropriate
- diagnostics
- no cache construction on audio callback

## P1 — UI / handling

Need executed evidence and optimization for:

- long vertical module pages
- horizontal strips/keyboards
- Piano Roll render cost
- meter/playhead render frequency
- large library/preset lists
- touch gesture arbitration
- keyboard note-off safety
- multi-touch
- safe areas/system navigation

## P1 — Android/native runtime

Need executed measurements for:

- actual audio latency
- xRuns
- frames per burst/buffer behavior
- lifecycle pause/resume
- device variance
- CPU Big/Little behavior
- thermal throttling
- battery impact

## P2 — Remix

File analysis exists, but full v4 live-input/device-capture workflow is not yet proven.

Required:
- live audio-input capability
- ring-buffer/analysis path
- beat/BPM synchronization to VibeCore Sync
- performance triggers/slices/gates/loops
- capability-gated Android playback capture where legally/technically supported

## P2 — Documentation

Legacy prompts, handovers, reports and statistics remain in the repository.

Required:
- label as `SUPERSEDED`, `HISTORICAL` or `SUPPORTING`
- prevent older docs from being interpreted as current ground truth
