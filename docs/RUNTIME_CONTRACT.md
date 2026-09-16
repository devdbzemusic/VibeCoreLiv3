# VibeCoreLiv3 — Runtime Contract

Status: DRAFT FOR IMPLEMENTATION
Date: 2026-09-16

## Purpose

Provide one frontend-facing runtime boundary regardless of whether audio is rendered by WebAudio or the native Android backend.

## Ownership

The UI must not select backend-specific implementation details directly.

```text
UI / Domain
   ↓
VibeCore Runtime API
   ├── WebAudioBackend
   └── NativeAndroidBackend
```

## Initial contract domains

### Transport

- play
- stop
- seek
- setTempo
- getPosition
- subscribeTransport

### Instrument performance

- noteOn
- noteOff
- allNotesOff
- audition

### Parameters

- setParameter
- getParameter
- subscribeParameter
- beginGesture
- endGesture

### Samples / assets

- loadSample
- releaseSample
- preloadSample
- querySampleState

### Runtime

- start
- suspend
- resume
- shutdown
- getBackendInfo

### Diagnostics

- snapshot
- getLatency
- getXRuns
- getAudioLoad

### Capabilities

- hasCapability
- getCapabilities

## Error model

Runtime operations must return/raise typed failures that can distinguish at least:

- validation
- unsupported capability
- device/audio failure
- lifecycle state
- bridge failure
- resource failure

## Performance rules

- no React rendering requirement for successful real-time parameter updates
- no file/network I/O on audio callback
- no repeated sample decode when cache entry is valid
- diagnostic subscriptions are rate-limited for UI
- transport/playhead UI derives from authoritative sync instead of globally mutating state per audio tick

## Migration rule

Existing direct WebAudio/native calls will be moved behind this contract incrementally. This document does not authorize a second audio engine or scheduler.
