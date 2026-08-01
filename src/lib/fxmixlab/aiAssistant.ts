// VibeCore FX Mix Lab — AI Mix Assistant.
//
// Assistive AI for mixing suggestions. Analyzes channel/bus levels and
// routing to propose gain staging, EQ, dynamics, and stereo adjustments.
//
// AI erzeugt ausschließlich Vorschläge — keine automatischen Änderungen.
// The caller (UI) decides whether to apply suggestions. Full undo/redo
// support via the existing store's immutable state updates.
//
// Deterministic: all suggestions are computed from analyzer snapshots
// and mixer state — no randomness, no external API calls, no LLM.

import type { AnalyzerSnapshot, MixAnalysis, MixSuggestion } from "./types";
import type { BusChannel, MixerChannel, ReturnChannel } from "./types";
import { linToDb } from "./analyzer";

// ── Gain Staging ──────────────────────────────────────────────────────────────

/** Suggest gain adjustments based on per-channel peak levels.
 *  Target: all channels in the -18..-12 dBFS range (healthy headroom). */
export function suggestGainStaging(
  channelPeaks: Map<number, number>,  // partId → peak (0..1)
  _channels: MixerChannel[],
): MixSuggestion[] {
  const suggestions: MixSuggestion[] = [];
  const TARGET_LOW = -20;  // dBFS
  const TARGET_HIGH = -10; // dBFS

  for (const [partId, peak] of channelPeaks) {
    const peakDb = linToDb(peak);
    if (peakDb > TARGET_HIGH) {
      // Too hot — suggest lowering volume
      const reductionDb = peakDb - TARGET_HIGH - 3;
      suggestions.push({
        type: "gain",
        channelRef: `part:${partId}`,
        currentValue: 100,
        suggestedValue: Math.max(0, 100 - reductionDb * 4),
        reason: `Channel peak ${peakDb.toFixed(1)} dBFS exceeds headroom — reduce gain by ~${reductionDb.toFixed(1)} dB`,
        confidence: 0.85,
      });
    } else if (peakDb < TARGET_LOW && peakDb > -60) {
      // Too quiet — suggest raising volume
      const boostDb = TARGET_LOW - peakDb;
      suggestions.push({
        type: "gain",
        channelRef: `part:${partId}`,
        currentValue: 100,
        suggestedValue: Math.min(100, 100 + boostDb * 4),
        reason: `Channel peak ${peakDb.toFixed(1)} dBFS is very low — raise gain by ~${boostDb.toFixed(1)} dB`,
        confidence: 0.6,
      });
    }
  }
  return suggestions;
}

// ── EQ Suggestions ────────────────────────────────────────────────────────────

/** Suggest EQ adjustments based on spectrum analysis.
 *  Detects muddy low-mids (200-500 Hz buildup) and harsh highs (3-5 kHz). */
export function suggestEQ(
  spectrum: Float32Array | undefined,
  _sampleRate: number,
  channelRef: string,
): MixSuggestion[] {
  if (!spectrum || spectrum.length < 8) return [];
  const suggestions: MixSuggestion[] = [];

  // Find the low-mid region (bins ~10-20 of 64 bins → ~200-800 Hz)
  const lowMidStart = Math.floor(spectrum.length * 0.15);
  const lowMidEnd = Math.floor(spectrum.length * 0.3);
  let lowMidEnergy = 0;
  for (let i = lowMidStart; i < lowMidEnd; i++) lowMidEnergy += spectrum[i];
  lowMidEnergy /= Math.max(1, lowMidEnd - lowMidStart);

  // Find the high region (bins ~30-45 → ~2-6 kHz)
  const highStart = Math.floor(spectrum.length * 0.45);
  const highEnd = Math.floor(spectrum.length * 0.6);
  let highEnergy = 0;
  for (let i = highStart; i < highEnd; i++) highEnergy += spectrum[i];
  highEnergy /= Math.max(1, highEnd - highStart);

  // Overall average
  let avg = 0;
  for (let i = 0; i < spectrum.length; i++) avg += spectrum[i];
  avg /= spectrum.length;

  if (lowMidEnergy > avg * 1.4) {
    suggestions.push({
      type: "eq",
      channelRef,
      paramRef: "eqMid",
      currentValue: 50,
      suggestedValue: 40,
      reason: "Low-mid buildup detected (~300 Hz) — reduce mid EQ by ~2 dB to clear mud",
      confidence: 0.7,
    });
  }

  if (highEnergy > avg * 1.5) {
    suggestions.push({
      type: "eq",
      channelRef,
      paramRef: "eqHigh",
      currentValue: 50,
      suggestedValue: 45,
      reason: "Harsh highs detected (~4 kHz) — reduce high EQ by ~1.5 dB to tame harshness",
      confidence: 0.65,
    });
  }

  return suggestions;
}

// ── Dynamics Suggestions ──────────────────────────────────────────────────────

/** Suggest dynamics processing based on crest factor. */
export function suggestDynamics(
  crestFactor: number,
  channelRef: string,
): MixSuggestion[] {
  const suggestions: MixSuggestion[] = [];
  if (crestFactor > 15) {
    // Very dynamic — suggest gentle compression
    suggestions.push({
      type: "dynamics",
      channelRef,
      paramRef: "compressor",
      currentValue: 0,
      suggestedValue: 1,
      reason: `Crest factor ${crestFactor.toFixed(1)} dB is very wide — add gentle compression (2:1, -18 dB threshold) for consistency`,
      confidence: 0.6,
    });
  } else if (crestFactor < 6) {
    // Already compressed — warn
    suggestions.push({
      type: "dynamics",
      channelRef,
      paramRef: "compressor",
      currentValue: 1,
      suggestedValue: 0,
      reason: `Crest factor ${crestFactor.toFixed(1)} dB is very narrow — channel may be over-compressed`,
      confidence: 0.5,
    });
  }
  return suggestions;
}

// ── Stereo Balance Suggestions ────────────────────────────────────────────────

export function suggestStereoBalance(
  balance: number,
  channelRef: string,
): MixSuggestion[] {
  if (Math.abs(balance) < 0.15) return [];
  return [{
    type: "stereo",
    channelRef,
    paramRef: "pan",
    currentValue: 0,
    suggestedValue: balance > 0 ? -Math.round(balance * 25) : Math.round(-balance * 25),
    reason: `Stereo balance is ${balance > 0 ? "R" : "L"}-heavy (${(Math.abs(balance) * 100).toFixed(0)}%) — consider panning ${balance > 0 ? "left" : "right"} to center`,
    confidence: 0.7,
  }];
}

// ── Routing Suggestions ───────────────────────────────────────────────────────

export function suggestRouting(
  channels: MixerChannel[],
  buses: BusChannel[],
  _returns: ReturnChannel[],
): MixSuggestion[] {
  const suggestions: MixSuggestion[] = [];
  // Suggest grouping drum parts to a drum bus
  const drumParts = channels.filter((ch) => ch.partId < 6 && ch.busTarget === "master");
  if (drumParts.length > 2 && !buses.some((b) => b.name === "DRUMS")) {
    suggestions.push({
      type: "routing",
      channelRef: "master",
      paramRef: "bus_drums",
      currentValue: 0,
      suggestedValue: 1,
      reason: `${drumParts.length} drum channels go directly to master — create a DRUMS bus for group processing`,
      confidence: 0.8,
    });
  }
  return suggestions;
}

// ── Full Mix Analysis ─────────────────────────────────────────────────────────

export function analyzeMix(
  snapshot: AnalyzerSnapshot,
  channelPeaks: Map<number, number>,
  channels: MixerChannel[],
  buses: BusChannel[],
  returns: ReturnChannel[],
  _partSpectra?: Map<number, Float32Array>,
  _sampleRate?: number,
): MixAnalysis {
  const suggestions: MixSuggestion[] = [];

  // Gain staging
  suggestions.push(...suggestGainStaging(channelPeaks, channels));

  // Routing
  suggestions.push(...suggestRouting(channels, buses, returns));

  // Dynamics (master)
  suggestions.push(...suggestDynamics(snapshot.crestFactor, "master"));

  // Stereo balance (master)
  suggestions.push(...suggestStereoBalance(snapshot.stereoBalance, "master"));

  // Sort by confidence (highest first)
  suggestions.sort((a, b) => b.confidence - a.confidence);

  return {
    suggestions,
    overallLoudness: snapshot.lufsIntegrated,
    stereoWidth: Math.abs(snapshot.stereoBalance) < 0.1 ? 0.8 : 1 - Math.abs(snapshot.stereoBalance),
    dynamicRange: snapshot.crestFactor,
    clippingRisk: snapshot.clipping || snapshot.headroomDb < 1,
  };
}