// Sound Forge Engine — Node interface.
// Pure-DSP, block-based, deterministic. No Web Audio API dependency so
// nodes can be exercised inside OfflineAudioContext, Vitest, or workers.

import type {
  ForgeAudioBlock,
  ForgeControlMsg,
  ForgeNodeDescriptor,
  ForgeNodeKind,
  ForgeSpectralFrame,
} from "./types";

export interface ForgeNodeInitOptions {
  sampleRate: number;
  blockSize: number;
  /** Optional seed for deterministic random nodes (tests). */
  seed?: number;
}

export interface ForgeNode {
  /** Stable kind matching a descriptor in the registry. */
  readonly kind: ForgeNodeKind;
  /** Initialize internal buffers / state. Called once before process(). */
  init(opts: ForgeNodeInitOptions): void;
  /**
   * Process a single block.
   * - inputs[i] = ith input channel (or empty array if unconnected).
   * - outputs must be filled with `blockSize` samples per output channel.
   * - controlMsgs are param ramp/step updates applied at block start.
   */
  process(
    inputs: ForgeAudioBlock,
    outputs: ForgeAudioBlock,
    controlMsgs: ForgeControlMsg[],
  ): void;
  /** Immediate param set (no ramp). Use setParam for ramped updates. */
  setParam(name: string, value: number, rampMs?: number): void;
  getParam(name: string): number;
  /** Optional spectral output for UI / neural feed. */
  getSpectral?(): ForgeSpectralFrame | null;
  /** Release any held resources. Called on graph teardown. */
  dispose?(): void;
}

/** Factory signature registered in the node registry. */
export type ForgeNodeFactory = (
  id: string,
  initialParams: Record<string, number>,
) => ForgeNode;

/** Helper base class with common param storage + ramping bookkeeping. */
export abstract class BaseForgeNode implements ForgeNode {
  abstract readonly kind: ForgeNodeKind;
  protected readonly descriptor: ForgeNodeDescriptor;
  protected sampleRate = 48000;
  protected blockSize = 128;
  protected params: Record<string, number> = {};
  /** Ramp state: target + per-sample increment. */
  protected ramps: Record<string, { target: number; inc: number; samplesLeft: number }> = {};

  constructor(descriptor: ForgeNodeDescriptor, initialParams: Record<string, number> = {}) {
    this.descriptor = descriptor;
    for (const p of descriptor.params) {
      this.params[p.id] = initialParams[p.id] ?? p.default;
    }
  }

  init(opts: ForgeNodeInitOptions): void {
    this.sampleRate = opts.sampleRate;
    this.blockSize = opts.blockSize;
  }

  setParam(name: string, value: number, rampMs = 0): void {
    if (!(name in this.params)) return;
    if (rampMs <= 0) {
      this.params[name] = value;
      delete this.ramps[name];
      return;
    }
    const samples = Math.max(1, Math.floor((rampMs / 1000) * this.sampleRate));
    const inc = (value - this.params[name]) / samples;
    this.ramps[name] = { target: value, inc, samplesLeft: samples };
  }

  getParam(name: string): number {
    return this.params[name];
  }

  /** Advance ramps by `n` samples and return the current value of `name`. */
  protected tickRamp(name: string, n = 1): number {
    const r = this.ramps[name];
    if (!r) return this.params[name];
    const step = Math.min(n, r.samplesLeft);
    this.params[name] += r.inc * step;
    r.samplesLeft -= step;
    if (r.samplesLeft <= 0) {
      this.params[name] = r.target;
      delete this.ramps[name];
    }
    return this.params[name];
  }

  abstract process(
    inputs: ForgeAudioBlock,
    outputs: ForgeAudioBlock,
    controlMsgs: ForgeControlMsg[],
  ): void;

  /** Apply pending control messages at block start. */
  protected applyControl(msgs: ForgeControlMsg[]): void {
    for (const m of msgs) this.setParam(m.param, m.value, m.rampMs ?? 0);
  }
}
