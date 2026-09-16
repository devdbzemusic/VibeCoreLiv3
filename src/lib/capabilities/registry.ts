// VibeCoreLiv3 - Capability Registry
//
// Purpose:
//   One authority for feature availability and evidence status. Static project
//   capability metadata and side-effect-free runtime probes intentionally live
//   together so UI/runtime modules do not invent their own environment checks.
//
// Rules:
//   - "ready" means implemented through the normal app contract.
//   - "partial" means present but incomplete for all v4.0 promises.
//   - "planned" means reserved/designed but not implemented.
//   - "blocked" means a known constraint prevents use.
//   - runtime probes NEVER initialize audio, request permission, open MIDI, or
//     create a second renderer. They only inspect already exposed platform APIs.
//   - verification describes evidence, not intent. Device/runtime behavior stays
//     NOT_EXECUTED until an actual build/device run proves it.

export type CapabilityStatus = "ready" | "partial" | "planned" | "blocked";
export type VerificationStatus = "VERIFIED" | "STATICALLY_VERIFIED" | "EXPECTED" | "UNKNOWN" | "NOT_EXECUTED";

export interface Capability {
  id: string;
  label: string;
  area:
    | "sync"
    | "audio"
    | "state"
    | "parameter"
    | "ai"
    | "learning"
    | "remix"
    | "android"
    | "instrument"
    | "sample"
    | "safety"
    | "repository";
  status: CapabilityStatus;
  verification: VerificationStatus;
  owner: string;
  contract?: string;
  notes?: string;
}

const CAPABILITIES: Capability[] = [
  {
    id: "sync.master-clock",
    label: "Single musical timebase",
    area: "sync",
    status: "ready",
    verification: "STATICALLY_VERIFIED",
    owner: "src/lib/clock + src/lib/audio/scheduler",
    contract: "Modules derive transport/timing from masterClock or scheduler timestamps.",
    notes: "Browser/native single-authority behavior still requires executed runtime proof. Tick domains currently differ (24 PPQ-style browser clock, sixteenth scheduler counters, native PPQ 1920).",
  },
  {
    id: "state.project-persist",
    label: "Project state persistence",
    area: "state",
    status: "ready",
    verification: "STATICALLY_VERIFIED",
    owner: "src/lib/store + src/lib/vcl3",
    contract: "Serializable project state flows through the Zustand project slice and VCL3 helpers.",
  },
  {
    id: "parameter.authoritative-hub",
    label: "Authoritative parameter hub",
    area: "parameter",
    status: "partial",
    verification: "STATICALLY_VERIFIED",
    owner: "src/lib/parameters/hub.ts + src/lib/store.ts",
    contract: "ParameterHub v1 is a stateless typed proxy over the existing authoritative store; it must not become a second state store.",
    notes: "Current v1 coverage is intentionally narrow. Gesture/automation/undo semantics remain follow-up work.",
  },
  {
    id: "ai.intent-layer",
    label: "AI suggestion intent layer",
    area: "ai",
    status: "partial",
    verification: "STATICALLY_VERIFIED",
    owner: "src/lib/ai",
    contract: "AI creates deterministic suggestions; full SUGGEST/PREVIEW/APPLY/REVERT/EXPLAIN lifecycle is pending.",
  },
  {
    id: "ai.learning-mode",
    label: "Project-local AI learning profile",
    area: "learning",
    status: "partial",
    verification: "STATICALLY_VERIFIED",
    owner: "src/lib/ai/learning.ts",
    contract: "Preferences are project-local, versioned, and require explicit opt-in before learned changes are stored.",
  },
  {
    id: "remix.audio-input",
    label: "Audio-input remix engine",
    area: "remix",
    status: "partial",
    verification: "STATICALLY_VERIFIED",
    owner: "src/components/groovebox/RemixTab.tsx + src/lib/ai/remixAudioInput.ts",
    contract: "Audio-file remix analysis detects BPM/key/energy/clipping and can sync project tempo; live device capture remains pending.",
  },
  {
    id: "android.native-oboe",
    label: "Native Android Oboe backend",
    area: "android",
    status: "ready",
    verification: "STATICALLY_VERIFIED",
    owner: "src/lib/audio/AudioBackend.ts + NativeOboeBackend.ts + native-android",
    contract: "WebView host injects VibeCoreNative; inspected TypeScript/Kotlin/JNI/C++ source reaches VibeCoreAudioEngine and its Oboe callback.",
    notes: "APK install/launch, callback activity, latency, xRuns, jitter, CPU/RAM and complete Groove-state mirroring are NOT_EXECUTED/UNKNOWN until device evidence exists.",
  },
  {
    id: "instrument.keyboard-performance",
    label: "3D Synth/Bass keyboard performance layer",
    area: "instrument",
    status: "partial",
    verification: "STATICALLY_VERIFIED",
    owner: "src/components/groovebox/InstrumentKeyboard.tsx + src/lib/runtime/performanceInput.ts",
    contract: "Migrated touch keyboard uses Runtime PerformanceInput. Native Bass has an explicit note lifecycle; Native 3D Synth remains unsupported until a renderer exists.",
  },
  {
    id: "sample.slot-integrity",
    label: "Sample slot semantic integrity",
    area: "sample",
    status: "partial",
    verification: "STATICALLY_VERIFIED",
    owner: "src/lib/model.ts + store actions",
    contract: "Explicit sample-category slots are guarded against Synth/Hybrid mutation; stricter drum-slot policy remains pending.",
  },
  {
    id: "repository.generated-artifacts",
    label: "Generated artifact exclusion",
    area: "repository",
    status: "ready",
    verification: "STATICALLY_VERIFIED",
    owner: ".gitignore",
    contract: "Gradle, CMake, built WebView assets, and ZIP exports are ignored and should not be tracked.",
  },
];

export function listCapabilities(): Capability[] {
  return CAPABILITIES.map((capability) => ({ ...capability }));
}

export function getCapability(id: string): Capability | undefined {
  const found = CAPABILITIES.find((capability) => capability.id === id);
  return found ? { ...found } : undefined;
}

export function listCapabilitiesByArea(area: Capability["area"]): Capability[] {
  return listCapabilities().filter((capability) => capability.area === area);
}

export function hasCapability(id: string, minimum: CapabilityStatus = "ready"): boolean {
  const capability = getCapability(id);
  if (!capability) return false;
  const rank: Record<CapabilityStatus, number> = {
    blocked: 0,
    planned: 1,
    partial: 2,
    ready: 3,
  };
  return rank[capability.status] >= rank[minimum];
}

// ─────────────────────────────────────────────────────────────────────────────
// Runtime capability probes
// ─────────────────────────────────────────────────────────────────────────────

export type RuntimeCapabilityId =
  | "audio.web"
  | "audio.native"
  | "audio.lowLatency.native"
  | "audio.input.web"
  | "preview.buffer.web"
  | "preview.buffer.native"
  | "instrument.synth3d.web"
  | "instrument.synth3d.native"
  | "instrument.bass3d.web"
  | "instrument.bass3d.native"
  | "voice.native"
  | "voice.liveInput.native"
  | "midi.input.web"
  | "storage.indexeddb";

export interface RuntimeCapabilityProbe {
  id: RuntimeCapabilityId;
  available: boolean;
  verification: VerificationStatus;
  reason?: string;
}

function browserAudioApiPresent(): boolean {
  if (typeof window === "undefined") return false;
  const candidate = window as typeof window & { webkitAudioContext?: typeof AudioContext };
  return typeof candidate.AudioContext !== "undefined" || typeof candidate.webkitAudioContext !== "undefined";
}

function nativeBridgeAvailable(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.VibeCoreNative?.isAvailable?.() === true;
  } catch {
    return false;
  }
}

function nativeMethod(name: keyof NonNullable<Window["VibeCoreNative"]>): boolean {
  if (!nativeBridgeAvailable()) return false;
  return typeof window.VibeCoreNative?.[name] === "function";
}

export function probeRuntimeCapability(id: RuntimeCapabilityId): RuntimeCapabilityProbe {
  const webAudio = browserAudioApiPresent();
  const native = nativeBridgeAvailable();

  switch (id) {
    case "audio.web":
      return {
        id,
        available: webAudio,
        verification: webAudio ? "EXPECTED" : "UNKNOWN",
        reason: webAudio ? "Browser exposes AudioContext" : "AudioContext API is not exposed",
      };
    case "audio.native":
      return {
        id,
        available: native,
        verification: native ? "STATICALLY_VERIFIED" : "NOT_EXECUTED",
        reason: native ? "VibeCoreNative bridge reports available" : "Native bridge is not present/available",
      };
    case "audio.lowLatency.native":
      return {
        id,
        available: native,
        verification: "NOT_EXECUTED",
        reason: native
          ? "Native Oboe path exists, but low-latency behavior is not measured yet"
          : "Native Oboe path unavailable",
      };
    case "audio.input.web": {
      const available = typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getUserMedia === "function";
      return {
        id,
        available,
        verification: available ? "EXPECTED" : "UNKNOWN",
        reason: available ? "getUserMedia API exposed; permission not requested" : "getUserMedia API unavailable",
      };
    }
    case "preview.buffer.web":
      return {
        id,
        available: webAudio,
        verification: webAudio ? "STATICALLY_VERIFIED" : "UNKNOWN",
        reason: webAudio ? "RuntimePreview reuses existing WebAudio preview path" : "WebAudio unavailable",
      };
    case "preview.buffer.native":
      return {
        id,
        available: false,
        verification: "STATICALLY_VERIFIED",
        reason: "No dedicated Native preview-buffer contract exists; Voice slots are not reserved for preview",
      };
    case "instrument.synth3d.web":
      return {
        id,
        available: webAudio,
        verification: webAudio ? "STATICALLY_VERIFIED" : "UNKNOWN",
        reason: webAudio ? "Existing Synth3D WebAudio voice engine is present" : "WebAudio unavailable",
      };
    case "instrument.synth3d.native":
      return {
        id,
        available: false,
        verification: "STATICALLY_VERIFIED",
        reason: "No dedicated Native 3D Synth renderer/JNI note lifecycle is source-proven",
      };
    case "instrument.bass3d.web":
      return {
        id,
        available: webAudio,
        verification: webAudio ? "STATICALLY_VERIFIED" : "UNKNOWN",
        reason: webAudio ? "Existing Bass3D WebAudio voice engine is present" : "WebAudio unavailable",
      };
    case "instrument.bass3d.native": {
      const available = native && nativeMethod("bassNoteOn") && nativeMethod("bassNoteOff") && nativeMethod("bassAllNotesOff");
      return {
        id,
        available,
        verification: available ? "STATICALLY_VERIFIED" : "UNKNOWN",
        reason: available ? "Native Bass note lifecycle bridge is exposed" : "Native Bass lifecycle bridge unavailable",
      };
    }
    case "voice.native": {
      const available = native && nativeMethod("voiceNoteOn") && nativeMethod("voiceNoteOff") && nativeMethod("voiceAllNotesOff");
      return {
        id,
        available,
        verification: available ? "STATICALLY_VERIFIED" : "UNKNOWN",
        reason: available ? "Native Voice lifecycle bridge is exposed" : "Native Voice lifecycle bridge unavailable",
      };
    }
    case "voice.liveInput.native": {
      const available = native && nativeMethod("voiceSetLiveInputEnabled") && nativeMethod("voiceLiveInputEnabled");
      return {
        id,
        available,
        verification: available ? "STATICALLY_VERIFIED" : "UNKNOWN",
        reason: available ? "Native Voice live-input bridge is exposed" : "Native Voice live-input bridge unavailable",
      };
    }
    case "midi.input.web": {
      const available = typeof navigator !== "undefined" && "requestMIDIAccess" in navigator;
      return {
        id,
        available,
        verification: available ? "EXPECTED" : "UNKNOWN",
        reason: available ? "Web MIDI API exposed; device access not requested" : "Web MIDI API unavailable",
      };
    }
    case "storage.indexeddb": {
      const available = typeof indexedDB !== "undefined";
      return {
        id,
        available,
        verification: available ? "EXPECTED" : "UNKNOWN",
        reason: available ? "IndexedDB API exposed" : "IndexedDB unavailable",
      };
    }
  }
}

export function runtimeCapabilityAvailable(id: RuntimeCapabilityId): boolean {
  return probeRuntimeCapability(id).available;
}

export function runtimeCapabilitySnapshot(): Record<RuntimeCapabilityId, RuntimeCapabilityProbe> {
  const ids: RuntimeCapabilityId[] = [
    "audio.web",
    "audio.native",
    "audio.lowLatency.native",
    "audio.input.web",
    "preview.buffer.web",
    "preview.buffer.native",
    "instrument.synth3d.web",
    "instrument.synth3d.native",
    "instrument.bass3d.web",
    "instrument.bass3d.native",
    "voice.native",
    "voice.liveInput.native",
    "midi.input.web",
    "storage.indexeddb",
  ];
  return Object.fromEntries(ids.map((id) => [id, probeRuntimeCapability(id)])) as Record<RuntimeCapabilityId, RuntimeCapabilityProbe>;
}
