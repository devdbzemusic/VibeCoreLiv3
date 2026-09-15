// VibeCoreLiv3 - Capability Registry
//
// Purpose:
//   Single readable inventory of platform capabilities required by the v4.0
//   governance model. This registry is intentionally declarative: modules can
//   ask what exists before they expose controls, AI actions, or import paths.
//
// Rules:
//   - "ready" means implemented and usable through the normal app contract.
//   - "partial" means present but not complete enough for all v4.0 promises.
//   - "planned" means reserved/designed but not implemented.
//   - "blocked" means known constraints prevent use.

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
    owner: "src/lib/store + module parameter helpers",
    contract: "Current parameter writes mostly flow through store actions; a dedicated hub is still pending.",
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
    verification: "VERIFIED",
    owner: "native-android",
    contract: "WebView bridge exposes VibeCoreNative and routes native audio through the Android host.",
  },
  {
    id: "instrument.keyboard-performance",
    label: "3D Synth/Bass keyboard performance layer",
    area: "instrument",
    status: "partial",
    verification: "STATICALLY_VERIFIED",
    owner: "src/components/groovebox/Synth3DPage.tsx + Bass3DPage.tsx",
    contract: "Piano Roll access exists; on-screen keyboard, external MIDI keyboard, and motion recorder are pending.",
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
