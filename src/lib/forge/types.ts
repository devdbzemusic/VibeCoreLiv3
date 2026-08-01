// Sound Forge Engine — core types
// Sprint 1 skeleton: 6 area buckets, node interface, preset JSON schema.

export type ForgeArea =
  | "source"     // Sample / Synth / FM / Granular / Noise / Resonator / Harmonic / Vocal
  | "shape"      // Envelopes, transient shaper, waveshaper, morph
  | "harmonics"  // Sub Core, Harmonic Core, Spatial Core, Resonance Core
  | "spatial"    // Reverb, binaural, stereo orbit, MS, HRTF
  | "evolution"  // Freeze, Stretch, Granular matrix, Morph, Resample
  | "output";    // Master routing, saturation matrix, limiter

/** Stable identifier for a node implementation. */
export type ForgeNodeKind = string;

/** Numeric parameter descriptor — used by UI + automation. */
export interface ForgeParamDef {
  id: string;
  label: string;
  min: number;
  max: number;
  default: number;
  unit?: string;
  /** "lin" | "log" | "exp" — UI mapping curve. */
  curve?: "lin" | "log" | "exp";
}

/** Static descriptor for a node kind (registered in registry.ts). */
export interface ForgeNodeDescriptor {
  kind: ForgeNodeKind;
  area: ForgeArea;
  label: string;
  /** Number of audio inputs / outputs (mono channels). */
  inputs: number;
  outputs: number;
  params: ForgeParamDef[];
}

/** Per-instance state inside a preset. */
export interface ForgeNodeState {
  /** Unique id within the graph. */
  id: string;
  kind: ForgeNodeKind;
  params: Record<string, number>;
}

/** Edge: srcNode output index -> dstNode input index. */
export interface ForgeEdge {
  from: string;       // node id
  fromPort: number;   // output index
  to: string;
  toPort: number;
}

/** Versioned preset JSON, persisted as .forge.json. */
export interface ForgePreset {
  version: 1;
  name: string;
  /** Optional category tag for UI grouping (kick/snare/hat/perc/bass/synth/exp). */
  category?: ForgePresetCategory;
  nodes: ForgeNodeState[];
  edges: ForgeEdge[];
  /** Explicit output node id. Falls back to last in topo order if absent. */
  outputNode?: string;
  /** Default render duration when auditioning / rendering offline (seconds). */
  durationSec?: number;
  /** One-shot automation events applied at offline render. */
  automation?: ForgeAutomationEvent[];
  /** Free-form macro mapping placeholder (Sprint 2). */
  macros?: Record<string, unknown>;
}

export type ForgePresetCategory =
  | "kick" | "snare" | "hat" | "perc" | "bass" | "synth" | "experimental";

/** Time-stamped parameter change applied during offline render.
 *  `atSec` measured from render start; `rampMs` uses BaseForgeNode ramping. */
export interface ForgeAutomationEvent {
  atSec: number;
  nodeId: string;
  param: string;
  value: number;
  rampMs?: number;
}

/** Runtime control message dispatched between blocks. */
export interface ForgeControlMsg {
  param: string;
  value: number;
  /** Optional ramp time in seconds. */
  rampMs?: number;
}

/** Read-only spectral feed for UI / neural encoder (Sprint 5+). */
export interface ForgeSpectralFrame {
  /** Magnitude bins, linear scale. */
  mag: Float32Array;
  /** Sample-rate the FFT was taken at. */
  sampleRate: number;
}

/** Audio buffer = one Float32Array per output channel, length = blockSize. */
export type ForgeAudioBlock = Float32Array[];
