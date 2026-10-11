# VibeCoreLiv3

VibeCoreLiv3 is a performance-oriented music workstation for Groove/Sequencing, Piano Roll editing, FX/Mixing, 3D Synth, 3D Bass, Voice, Remix, VibeCore AI and bRAINWAVEz.

The project combines a React/Vite UI with Android WebView integration and a native Kotlin/JNI/C++/Oboe audio path.

## Canonical engineering specification

`docs/VibeCore_Univers_SUPREME_MasterPrompt_UNIFIED_v4.0.md`

This is the normative engineering contract for architecture, real-time audio, sync, state, parameter ownership, AI, Android, UX and verification.

## Current development phase

**RUNTIME CONSOLIDATION & UX PERFORMANCE REVISION**

Current work focuses on:

- one authoritative musical sync/timebase
- one persistent state truth
- central Parameter Hub
- central Capability Registry
- one frontend Runtime API over WebAudio and Native Android backends
- strict Sample/Synth instrument boundaries
- caching and memory budgets
- React/UI performance
- Android touch/latency/thermal behavior
- AI Intent/Validation/Command boundaries
- Motion Recorder integration
- Remix live-input capabilities
- executed E2E and performance verification

See:

- `docs/PROJECT_STATUS.md`
- `docs/ARCHITECTURE.md`
- `docs/CAPABILITY_MATRIX.md`
- `docs/TEST_STATUS.md`
- `docs/KNOWN_GAPS.md`

## Development

Install dependencies:

```bash
npm install
```

Frontend development:

```bash
npm run dev
```

Static checks/tests:

```bash
npm run typecheck
npm run lint
npm run test
```

Web build:

```bash
npm run build
```

Android-targeted web build:

```bash
npm run build:android
```

Native Android project:

`native-android/`

Build/install/runtime results must only be called `VERIFIED` after they have actually been executed and evidence has been recorded.

## Architecture summary

```text
React UI
  ↓
Domain Commands / Parameter Hub
  ↓
VibeCore Runtime API
  ├── WebAudioBackend
  └── NativeAndroidBackend
        ↓
      Kotlin Bridge
        ↓
      JNI
        ↓
      C++ / Oboe
```

VibeCore Sync is the sole authoritative musical timebase.

## Product principle

VibeCore should feel like an instrument rather than a conventional application:

```text
Start → choose/create a musical idea → play → shape → record → continue
```

Advanced technical detail should remain available without dominating the live performance workflow.
