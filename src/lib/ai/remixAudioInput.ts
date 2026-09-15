import { analyzeSample, type SampleAnalysis } from "@/lib/sampleforge";
import type { PCM } from "@/lib/audio/sampleForge";

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export interface RemixAudioInputAnalysis {
  durationSec: number;
  bpm: number;
  targetBpm?: number;
  tempoDeltaPct?: number;
  keyLabel: string;
  energy: "low" | "medium" | "high";
  loudness: number;
  peak: number;
  rms: number;
  clipping: boolean;
  confidence: number;
  summary: string;
  source: SampleAnalysis;
}

export interface RemixAudioInputOptions {
  targetBpm?: number;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return mins > 0 ? `${mins}:${secs.toString().padStart(2, "0")}` : `${secs}s`;
}

function formatKey(root: number, mode: "major" | "minor"): string {
  return `${NOTE_NAMES[((root % 12) + 12) % 12]} ${mode}`;
}

function energyFromRms(rms: number): RemixAudioInputAnalysis["energy"] {
  if (rms >= 0.18) return "high";
  if (rms >= 0.07) return "medium";
  return "low";
}

export function analyzeRemixAudioInput(
  pcm: PCM,
  options: RemixAudioInputOptions = {},
): RemixAudioInputAnalysis {
  const source = analyzeSample(pcm);
  const tempoDeltaPct = source.bpm > 0 && options.targetBpm
    ? Math.round(((source.bpm - options.targetBpm) / options.targetBpm) * 1000) / 10
    : undefined;
  const keyLabel = formatKey(source.key.root, source.key.mode);
  const energy = energyFromRms(source.rms);
  const confidence = clamp01(
    (source.bpm > 0 ? 0.35 : 0)
    + source.key.confidence * 0.25
    + Math.min(source.peak, 1) * 0.2
    + Math.min(source.durationSec / 16, 1) * 0.2,
  );
  const tempoText = source.bpm > 0 ? `${source.bpm} BPM` : "tempo unknown";
  const deltaText = typeof tempoDeltaPct === "number" ? `, ${tempoDeltaPct > 0 ? "+" : ""}${tempoDeltaPct}% vs project` : "";

  return {
    durationSec: source.durationSec,
    bpm: source.bpm,
    targetBpm: options.targetBpm,
    tempoDeltaPct,
    keyLabel,
    energy,
    loudness: source.loudness,
    peak: source.peak,
    rms: source.rms,
    clipping: source.clipping.clipped,
    confidence,
    summary: `${formatDuration(source.durationSec)} · ${tempoText}${deltaText} · ${keyLabel} · ${energy} energy`,
    source,
  };
}
