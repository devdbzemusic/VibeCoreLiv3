// VibeCore AI — Sample Assistant.
//
// Erweitert den bestehenden `sampleforge/aiAssistant` um zentrale Sample-
// Vorschläge (Slice, Loop, BPM, Tonart, Klassifikation, Similarity Search,
// Tagging). Die AI erzeugt ausschließlich Vorschläge — angewendet über
// `setPartSlices` / `setWaveEdit`.

import type { ContextSnapshot, Suggestion, SamplePayload } from "./types";
import { suggestionId } from "./engine";
import type { PCM } from "@/lib/audio/sampleForge";
import {
  suggestSlices, suggestLoopPoints, generateSampleTags,
  classifyDrum, classifyInstrument, computeFingerprint, findSimilarSamples,
  type SampleFingerprint,
} from "@/lib/sampleforge/aiAssistant";

export interface SampleOpts {
  seed?: number;
  partId?: number;
  pcm?: PCM;
  library?: SampleFingerprint[];
}

/** Suggest a slice configuration for a sample. */
export function suggestSliceConfig(
  _ctx: ContextSnapshot, pcm: PCM, partId?: number,
): Suggestion<SamplePayload> {
  const seed = 0x510C0;
  if (!pcm || !pcm.channels[0]?.length) {
    return {
      id: suggestionId("sample", seed), kind: "sample", label: "No Sample",
      description: "No sample loaded — load a sample to get slice suggestions.",
      confidence: 0.3, seed, payload: {},
    };
  }
  const result = suggestSlices(pcm);
  return {
    id: suggestionId("sample", seed), kind: "sample", label: "Slice Suggestion",
    description: result.rationale,
    confidence: 0.75, seed,
    payload: {
      partId,
      slices: result.slices.map((s) => ({
        start: s.start, end: s.end, name: s.name, velocity: s.velocity,
      })),
    },
  };
}

/** Suggest loop points for a sample. */
export function suggestLoopConfig(
  _ctx: ContextSnapshot, pcm: PCM, partId?: number,
): Suggestion<SamplePayload> {
  const seed = 0x1000;
  if (!pcm || !pcm.channels[0]?.length) {
    return {
      id: suggestionId("sample", seed), kind: "sample", label: "No Sample",
      description: "No sample loaded for loop detection.",
      confidence: 0.3, seed, payload: {},
    };
  }
  const result = suggestLoopPoints(pcm);
  return {
    id: suggestionId("sample", seed), kind: "sample", label: "Loop Points",
    description: result.rationale,
    confidence: 0.7, seed,
    payload: { partId, loop: { startNorm: result.startNorm, endNorm: result.endNorm, bpm: result.bpm, bars: result.bars } },
  };
}

/** Classify a sample (drum type + instrument type + tags). */
export function suggestClassification(
  _ctx: ContextSnapshot, pcm: PCM, partId?: number,
): Suggestion<SamplePayload> {
  const seed = 0xC1A00;
  if (!pcm || !pcm.channels[0]?.length) {
    return {
      id: suggestionId("sample", seed), kind: "sample", label: "No Sample",
      description: "No sample loaded for classification.",
      confidence: 0.3, seed, payload: {},
    };
  }
  const drum = classifyDrum(pcm);
  const inst = classifyInstrument(pcm);
  const tags = generateSampleTags(pcm);
  return {
    id: suggestionId("sample", seed), kind: "sample", label: "Classification",
    description: `${inst.class} (${(inst.confidence * 100).toFixed(0)}%) — drum: ${drum.class}`,
    confidence: Math.max(inst.confidence, drum.confidence), seed,
    payload: { partId, tags, classification: `${inst.class}/${drum.class}` },
  };
}

/** Find similar samples in a library. */
export function suggestSimilar(
  _ctx: ContextSnapshot, pcm: PCM, library: SampleFingerprint[], topN = 5,
): Suggestion<SamplePayload> {
  const seed = 0x51A00;
  if (!pcm || !pcm.channels[0]?.length || !library.length) {
    return {
      id: suggestionId("sample", seed), kind: "sample", label: "No Matches",
      description: "No sample or library available for similarity search.",
      confidence: 0.3, seed, payload: {},
    };
  }
  const fp = computeFingerprint(pcm);
  const results = findSimilarSamples(fp, library, topN);
  return {
    id: suggestionId("sample", seed), kind: "sample", label: "Similar Samples",
    description: `Top ${results.length} similar samples (best: ${((results[0]?.similarity ?? 0) * 100).toFixed(0)}%).`,
    confidence: 0.7, seed,
    payload: { tags: results.map((r) => `match_${r.idx}:${r.similarity.toFixed(2)}`) },
  };
}