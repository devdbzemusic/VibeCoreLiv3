# VibeCoreLiv3 — Revision Plan v4

## Runtime Consolidation, Caching, Performance, Handling & Usability

Current phase: **RUNTIME CONSOLIDATION & UX PERFORMANCE REVISION**

### Sprint A — Project truth and architecture baseline
- canonical project status
- architecture target
- capability matrix
- explicit test status
- known gaps
- README revision
- initial ADRs

### Sprint B — Sample/Synth boundary migration
- inventory all `Part.source` reads/writes
- define explicit instrument ownership
- compatibility migration for legacy projects
- remove invalid Sample→Synth UI transitions
- update presets/serialization/AI/undo/tests

### Sprint C — Runtime Contract
- one frontend Runtime API
- WebAudioBackend
- NativeAndroidBackend
- versioned bridge contract
- eliminate direct backend ownership in UI

### Sprint D — Parameter Hub
- typed parameter identifiers
- get/set/subscribe
- gesture lifecycle
- MIDI/AI/automation/preset integration
- direct DSP path with throttled UI feedback

### Sprint E — Capability Registry
- typed capabilities
- platform/runtime providers
- availability reason + fallback
- UI feature gating
- diagnostics integration

### Sprint F — Caching layer
- decoded PCM cache
- resampled PCM cache
- waveform peak pyramid cache
- BPM/key/transient analysis cache
- AI context cache
- native preallocated buffer/voice pools
- explicit budgets, invalidation and cache diagnostics

### Sprint G — React/UI performance
- selector audit
- render isolation
- meter/playhead decoupling
- Piano Roll rendering revision
- long-list virtualization
- transform/opacity-only animation review where practical

### Sprint H — Android/native performance
- Oboe low-latency/device settings
- xRun diagnostics
- buffer tuning
- CPU/thermal profiling
- quality governor
- lifecycle recovery

### Sprint I — Handling & usability
- simplify primary workflow
- progressive disclosure
- touch target audit
- gesture arbitration
- multi-touch keyboard
- robust note-off handling
- clearer error/recovery feedback
- startup/lazy-loading revision

### Sprint J — AI Intent and Motion Recorder
- centralized intent/validation/command path
- Suggest/Preview/Apply/Revert/Explain
- synchronized motion recording through Parameter Hub
- persistent/editable automation data

### Sprint K — Remix live input
- capability-gated input
- ring-buffer analysis path
- BPM/beat estimation
- Master Sync coupling
- real-time remix events
- optional device playback capture where supported

### Sprint L — Verification
- typecheck/lint/unit
- web and Android build
- native build
- APK install/launch
- fatal scan
- E2E matrix
- touch/frame pacing
- latency/xRuns
- CPU/memory/thermal
- DSP/reference audio where relevant

## UX target

VibeCore should feel like an instrument rather than a configuration-heavy application:

```text
HOME → GROOVE → SOUND → MIX → PERFORM
```

Advanced capabilities stay accessible through contextual/deep views without dominating the live workflow.

## Performance target principles

- UI work never threatens audio deadlines
- no cache construction on the audio callback
- no repeated audio decoding when content is unchanged
- no global-state updates at audio/meter rate
- derived data stays out of persistent project state
- long grids/lists render only what is needed
- startup becomes interactive before heavyweight analysis/assets finish loading
- autosave is debounced and crash-safe

## Done

Revision is complete only when the v4.0 Definition of Done is satisfied and applicable runtime/build tests have concrete evidence.