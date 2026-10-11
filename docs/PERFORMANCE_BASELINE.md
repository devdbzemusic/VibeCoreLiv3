# VibeCoreLiv3 — Performance Baseline

Stand: 2026-09-16

No values in this file are assumed. Measurements remain `NOT EXECUTED` until captured on a concrete commit/environment.

## Startup

- cold start to shell visible — NOT EXECUTED
- cold start to UI interactive — NOT EXECUTED
- cold start to audio ready — NOT EXECUTED
- project restore duration — NOT EXECUTED

## UI

- idle FPS/frame pacing — NOT EXECUTED
- vertical scrolling frame pacing — NOT EXECUTED
- horizontal strip/keyboard scrolling — NOT EXECUTED
- Piano Roll drag/render cost — NOT EXECUTED
- Mixer meter update cost — NOT EXECUTED
- React commit/render hotspots — NOT EXECUTED
- event-loop lag under audio playback — NOT EXECUTED

## Audio

- backend selected — NOT EXECUTED
- sample rate — NOT EXECUTED
- buffer / frames per burst — NOT EXECUTED
- measured output latency — NOT EXECUTED
- xRuns/underruns — NOT EXECUTED
- active voices at stable playback — NOT EXECUTED
- CPU audio load — NOT EXECUTED

## Memory / cache

- project memory after load — NOT EXECUTED
- decoded PCM memory — NOT EXECUTED
- waveform cache memory — NOT EXECUTED
- analysis cache memory — NOT EXECUTED
- cache hit/miss rate — NOT EXECUTED
- eviction behavior — NOT EXECUTED

## Android

- foreground CPU — NOT EXECUTED
- background CPU — NOT EXECUTED
- thermal behavior — NOT EXECUTED
- battery behavior — NOT EXECUTED
- pause/resume recovery — NOT EXECUTED

## Measurement principle

Every measurement must record:

- commit SHA
- device/browser
- OS/API level
- sample rate/buffer where relevant
- project/test case
- measurement method
- result
- regression threshold if established
