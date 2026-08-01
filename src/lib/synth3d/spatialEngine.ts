// VibeCore 3D Synth — Spatial Engine.
//
// Per-part spatial processing chain using DSP Core spatial primitives.
// The chain is created once per part and cached — all voices for that part
// route through the shared spatial chain before reaching chain.input.
//
// Modes: stereo width, Mid/Side, binaural, 3D (PannerNode).
// The chain can be dynamically updated when spatial parameters change.
//
// Realtime-safe: chain creation is control-thread (graph construction).
// All spatial DSP runs on the UA audio thread via native nodes.

import {
  createStereoWidth, createMidSide, createBinaural, createSpatial3D,
  clamp,
} from "@/lib/dsp";
import type { SpatialParams3D } from "./params";

export interface Spatial3DChain {
  input: GainNode;
  output: GainNode;
  widthGain?: GainNode;     // stereo width control
  panner?: StereoPannerNode | PannerNode;
  distanceGain?: GainNode;
  mode: SpatialParams3D["mode"];
}

const _chains = new Map<number, Spatial3DChain>();

/**
 * Get or create the spatial chain for a part. The chain's output should be
 * connected to chain.input by the caller. All voices connect to chain.input
 * (the spatial chain's input gain).
 */
export function getSpatialChain(
  ctx: BaseAudioContext, partId: number, p: SpatialParams3D,
): Spatial3DChain {
  const existing = _chains.get(partId);
  if (existing) {
    updateSpatialChain(ctx, existing, p);
    return existing;
  }
  const chain = buildSpatialChain(ctx, p);
  _chains.set(partId, chain);
  return chain;
}

function buildSpatialChain(ctx: BaseAudioContext, p: SpatialParams3D): Spatial3DChain {
  const input = ctx.createGain();
  const output = ctx.createGain();

  if (!p.enabled || p.mode === "stereo") {
    // Stereo width mode — M/S decomposition with width control
    const width = createStereoWidth(ctx, p.width);
    input.connect(width.input);
    width.output.connect(output);
    return { input, output, widthGain: width.widthGain, mode: p.mode };
  }

  if (p.mode === "ms") {
    // M/S encode → width → M/S decode
    const enc = createMidSide(ctx, "encode");
    const width = createStereoWidth(ctx, p.width);
    const dec = createMidSide(ctx, "decode");
    input.connect(enc.input);
    enc.output.connect(width.input);
    width.output.connect(dec.input);
    dec.output.connect(output);
    return { input, output, widthGain: width.widthGain, mode: p.mode };
  }

  if (p.mode === "binaural") {
    // Binaural panning with distance attenuation
    const binaural = createBinaural(ctx, {
      azimuth: p.azimuth, elevation: p.elevation, distance: p.distance,
    });
    input.connect(binaural.input);
    binaural.output.connect(output);
    return { input, output, panner: binaural.panner, distanceGain: binaural.distanceGain, mode: p.mode };
  }

  // 3D mode — full PannerNode with position
  const spatial3d = createSpatial3D(ctx, {
    x: Math.sin((p.azimuth * Math.PI) / 180),
    y: 0,
    z: Math.cos((p.azimuth * Math.PI) / 180),
  });
  input.connect(spatial3d.input);
  spatial3d.panner.connect(output);
  return { input, output, panner: spatial3d.panner, mode: p.mode };
}

/** Update an existing spatial chain's parameters without rebuilding the graph.
 *  Only width and pan/position are updated — mode changes require rebuild. */
export function updateSpatialChain(
  ctx: BaseAudioContext, chain: Spatial3DChain, p: SpatialParams3D,
): void {
  if (chain.mode !== p.mode) {
    // Mode changed — rebuild the internal path.
    // Disconnect chain.input's outgoing connections (old internal path),
    // but do NOT disconnect chain.output — its downstream connection to the
    // part's chain.input must be preserved. Old internal nodes become silent
    // (no input) and will be garbage-collected with the AudioContext.
    try { chain.input.disconnect(); } catch { /* noop */ }

    const newChain = buildSpatialChain(ctx, p);
    // Route: old chain.input → new internal path → old chain.output
    chain.input.connect(newChain.input);
    newChain.output.connect(chain.output);

    chain.widthGain = newChain.widthGain;
    chain.panner = newChain.panner;
    chain.distanceGain = newChain.distanceGain;
    chain.mode = newChain.mode;
    return;
  }

  if (chain.widthGain) {
    chain.widthGain.gain.value = clamp(p.width, 0, 2);
  }
  if (chain.panner && "pan" in chain.panner) {
    (chain.panner as StereoPannerNode).pan.value = Math.sin((p.azimuth * Math.PI) / 180);
  }
  if (chain.distanceGain) {
    chain.distanceGain.gain.value = 1 / (1 + clamp(p.distance, 0, 1) * 3);
  }
  if (chain.panner && "positionX" in chain.panner) {
    const pn = chain.panner as PannerNode;
    pn.positionX.value = Math.sin((p.azimuth * Math.PI) / 180) * 10;
    pn.positionZ.value = Math.cos((p.azimuth * Math.PI) / 180) * 10;
  }
}

/** Clear the cached spatial chain for a part (call on audio restart). */
export function clearSpatialChain(partId: number): void {
  _chains.delete(partId);
}

/** Clear all cached spatial chains (call on audio restart). */
export function clearAllSpatialChains(): void {
  _chains.clear();
}