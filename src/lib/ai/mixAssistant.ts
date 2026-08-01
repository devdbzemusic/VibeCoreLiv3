// VibeCore AI — Mix Assistant.
//
// Erweitert den bestehenden `fxmixlab/aiAssistant` um zentrale Mix-Vorschläge
// (Gain Staging, EQ, Dynamik, Stereo-Balance, Routing, Clipping-Warnungen).
// Die AI erzeugt ausschließlich Vorschläge — keine automatischen Änderungen.
// Angewendet über `setPartVolume` / `setSend` / `setMaster` / `setFxParam`.

import type { ContextSnapshot, Suggestion, MixPayload } from "./types";
import { suggestionId } from "./engine";

export interface MixOpts {
  seed?: number;
  partPeaks?: Map<number, number>;
  masterPeak?: number;
}

const TARGET_HIGH_DB = -10;
const TARGET_LOW_DB = -20;

function linToDb(x: number): number {
  if (x <= 0) return -60;
  return 20 * Math.log10(x);
}

export function suggestGainStaging(
  ctx: ContextSnapshot, opts: MixOpts = {},
): Suggestion<MixPayload>[] {
  const seed = opts.seed ?? 100100;
  const peaks = opts.partPeaks ?? new Map<number, number>();
  const out: Suggestion<MixPayload>[] = [];

  for (const part of ctx.parts) {
    const peak = peaks.get(part.id) ?? 0;
    if (peak <= 0) continue;
    const peakDb = linToDb(peak);
    if (peakDb > TARGET_HIGH_DB) {
      const reductionDb = peakDb - TARGET_HIGH_DB - 3;
      out.push({
        id: suggestionId("mix", seed + part.id), kind: "mix", label: `Lower ${part.name}`,
        description: `Peak ${peakDb.toFixed(1)} dBFS exceeds headroom — reduce gain by ~${reductionDb.toFixed(1)} dB.`,
        confidence: 0.85, seed,
        payload: { partId: part.id, param: "volume", value: Math.max(0, part.volume - reductionDb * 4),
          reason: `Gain reduction for headroom` },
      });
    } else if (peakDb < TARGET_LOW_DB && peakDb > -60) {
      const boostDb = TARGET_LOW_DB - peakDb;
      out.push({
        id: suggestionId("mix", seed + part.id + 100), kind: "mix", label: `Raise ${part.name}`,
        description: `Peak ${peakDb.toFixed(1)} dBFS is very low — raise gain by ~${boostDb.toFixed(1)} dB.`,
        confidence: 0.6, seed,
        payload: { partId: part.id, param: "volume", value: Math.min(100, part.volume + boostDb * 4),
          reason: `Gain boost for level` },
      });
    }
  }
  return out;
}

export function warnClipping(
  ctx: ContextSnapshot, opts: MixOpts = {},
): Suggestion<MixPayload>[] {
  const seed = opts.seed ?? 200100;
  const masterPeak = opts.masterPeak ?? 0;
  const out: Suggestion<MixPayload>[] = [];
  if (masterPeak >= 0.99) {
    out.push({
      id: suggestionId("mix", seed), kind: "mix", label: "Master Clipping",
      description: `Master peak at ${(linToDb(masterPeak)).toFixed(1)} dBFS — engage limiter or reduce mix levels.`,
      confidence: 0.9, seed,
      payload: { param: "master_eqMid", value: ctx.master.eqMid - 2, reason: "Reduce master to prevent clipping" },
    });
  }
  return out;
}

export function suggestEQ(ctx: ContextSnapshot, _opts: MixOpts = {}): Suggestion<MixPayload>[] {
  const seed = 300000;
  const out: Suggestion<MixPayload>[] = [];
  const kick = ctx.parts.find((p) => p.category === "kick");
  if (kick) {
    out.push({
      id: suggestionId("mix", seed), kind: "mix", label: `Kick: cut mud`,
      description: "Reduce kick low-mid (~300 Hz) to clear room for the bass.",
      confidence: 0.6, seed,
      payload: { partId: kick.id, param: "fx_param", fxIdx: 4, fxParamKey: "B", value: 42, reason: "Low-mid cut" },
    });
  }
  const bass = ctx.parts.find((p) => p.category === "bass");
  if (bass) {
    out.push({
      id: suggestionId("mix", seed + 1), kind: "mix", label: `Bass: boost lows`,
      description: "Slight low-shelf boost on bass for sub presence.",
      confidence: 0.55, seed,
      payload: { partId: bass.id, param: "fx_param", fxIdx: 4, fxParamKey: "A", value: 58, reason: "Low-end boost" },
    });
  }
  return out;
}

export function suggestMix(
  ctx: ContextSnapshot, opts: MixOpts = {},
): Suggestion<MixPayload>[] {
  const all = [
    ...suggestGainStaging(ctx, opts),
    ...warnClipping(ctx, opts),
    ...suggestEQ(ctx, opts),
  ];
  return all.sort((a, b) => b.confidence - a.confidence);
}