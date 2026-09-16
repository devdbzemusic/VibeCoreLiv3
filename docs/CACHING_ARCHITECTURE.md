# VibeCoreLiv3 — Caching Architecture

Status: DRAFT FOR IMPLEMENTATION
Date: 2026-09-16

## Goal

Reduce repeated decoding, analysis and rendering work without creating a second source of project truth.

Caches are transient/derived infrastructure. They must be reconstructible from authoritative state/assets.

## Cache domains

### 1. Raw asset cache
Key: canonical asset identity + content/version metadata.

Purpose:
- avoid repeated file fetch/read where platform allows
- centralize lifecycle and invalidation

### 2. Decoded PCM cache
Key:

```text
assetHash + decoderVersion + channelMode
```

Stores reusable decoded audio buffers.

### 3. Resampled PCM cache
Key:

```text
assetHash + targetSampleRate + resamplerVersion
```

Only create outside the real-time callback.

### 4. Waveform peak pyramid
Key:

```text
assetHash + peakAlgorithmVersion
```

Stores multi-resolution min/max peaks for fast waveform zoom and scrolling.

### 5. Audio analysis cache
Key:

```text
assetHash + algorithmVersion + settingsHash
```

May contain:
- BPM/tempo
- beat grid
- key
- energy
- loudness
- transients
- suggested slices

### 6. AI context cache
Key:

```text
projectRevision + patternRevision + sceneRevision + partContext + aiContextVersion
```

Only rebuild when relevant musical context changes.

### 7. Native real-time pools
Preallocated runtime resources:
- sample buffers/handles
- voice pool
- DSP scratch buffers
- routing/graph scratch structures where appropriate

These are real-time resources, not persistent project caches.

## Core policies

- explicit memory budget per cache domain
- LRU eviction for suitable shared caches
- ref-count/pinning for assets currently in use
- hash/version based invalidation
- no cache construction or eviction work on the audio callback
- diagnostics expose hit/miss/eviction/memory metrics
- derived cache content is never required for project recovery

## Initial budget strategy

Budgets must remain device-aware instead of hard-coding one universal limit.

Suggested policy inputs:
- available memory class
- native/web runtime
- current project size
- active voices
- thermal/performance mode

The Capability Registry/runtime will expose available policy information. Concrete byte budgets require measured baselines and therefore remain uncommitted until profiling is executed.

## UX impact

Caching should improve:
- sample browsing
- waveform opening/zooming
- remix analysis reopening
- project switching
- repeated audition
- AI suggestion latency

Cache misses may show a lightweight progress state, but should not freeze the main UI.

## Diagnostics

Expose:
- entries
- memory usage
- hits
- misses
- hit ratio
- evictions
- decode time
- analysis time
- waveform generation time
