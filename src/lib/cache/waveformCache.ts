import { ResourceCache } from "./resourceCache";

export interface WaveformPeakLevel {
  /** Number of source PCM frames represented by one min/max pair. */
  samplesPerBin: number;
  /** Interleaved [min, max, min, max, ...] values in -1..1 PCM domain. */
  minMax: Float32Array;
}

export interface WaveformPeakPyramid {
  sampleRate: number;
  lengthFrames: number;
  channels: number;
  levels: WaveformPeakLevel[];
}

export interface BuildWaveformPyramidOptions {
  /** Smallest bin at level 0. Defaults to 64 source frames. */
  baseSamplesPerBin?: number;
  /** Stops generating levels once the coarsest level has <= this many bins. */
  terminalBins?: number;
}

export function waveformCacheKey(assetId: string, assetRevision: string | number): string {
  return `${assetId}::${String(assetRevision)}`;
}

function validBaseSize(value: number | undefined): number {
  if (value == null) return 64;
  if (!Number.isInteger(value) || value <= 0) throw new RangeError("baseSamplesPerBin must be a positive integer");
  return value;
}

/**
 * Build a deterministic min/max peak pyramid from decoded PCM channels.
 *
 * This is control/offline work only. It must never run inside the realtime
 * audio callback. Higher levels aggregate the previous level pairwise rather
 * than rescanning PCM, so zoom changes can reuse already prepared peaks.
 */
export function buildWaveformPeakPyramidFromChannels(
  pcmChannels: readonly Float32Array[],
  sampleRate: number,
  options: BuildWaveformPyramidOptions = {},
): WaveformPeakPyramid {
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) throw new RangeError("sampleRate must be positive");
  if (pcmChannels.length === 0) {
    return { sampleRate, lengthFrames: 0, channels: 0, levels: [] };
  }

  const lengthFrames = Math.max(0, ...pcmChannels.map((channel) => channel.length));
  const baseSamplesPerBin = validBaseSize(options.baseSamplesPerBin);
  const terminalBins = Math.max(1, Math.floor(options.terminalBins ?? 32));
  const binCount = Math.max(1, Math.ceil(lengthFrames / baseSamplesPerBin));
  const base = new Float32Array(binCount * 2);

  for (let bin = 0; bin < binCount; bin++) {
    const start = bin * baseSamplesPerBin;
    const end = Math.min(lengthFrames, start + baseSamplesPerBin);
    let min = 1;
    let max = -1;
    let sawSample = false;

    for (const channel of pcmChannels) {
      const channelEnd = Math.min(channel.length, end);
      for (let i = start; i < channelEnd; i++) {
        const value = Number.isFinite(channel[i]) ? Math.max(-1, Math.min(1, channel[i])) : 0;
        if (value < min) min = value;
        if (value > max) max = value;
        sawSample = true;
      }
    }

    base[bin * 2] = sawSample ? min : 0;
    base[bin * 2 + 1] = sawSample ? max : 0;
  }

  const levels: WaveformPeakLevel[] = [{ samplesPerBin: baseSamplesPerBin, minMax: base }];
  let previous = base;
  let samplesPerBin = baseSamplesPerBin;

  while (previous.length / 2 > terminalBins) {
    const previousBins = previous.length / 2;
    const nextBins = Math.ceil(previousBins / 2);
    const next = new Float32Array(nextBins * 2);

    for (let bin = 0; bin < nextBins; bin++) {
      const first = bin * 2;
      const second = first + 1;
      let min = previous[first * 2];
      let max = previous[first * 2 + 1];
      if (second < previousBins) {
        min = Math.min(min, previous[second * 2]);
        max = Math.max(max, previous[second * 2 + 1]);
      }
      next[bin * 2] = min;
      next[bin * 2 + 1] = max;
    }

    samplesPerBin *= 2;
    levels.push({ samplesPerBin, minMax: next });
    previous = next;
  }

  return {
    sampleRate,
    lengthFrames,
    channels: pcmChannels.length,
    levels,
  };
}

export function buildWaveformPeakPyramid(
  buffer: AudioBuffer,
  options: BuildWaveformPyramidOptions = {},
): WaveformPeakPyramid {
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, index) => buffer.getChannelData(index));
  return buildWaveformPeakPyramidFromChannels(channels, buffer.sampleRate, options);
}

/** Choose the finest level that does not oversample the target pixel density. */
export function selectWaveformPeakLevel(
  pyramid: WaveformPeakPyramid,
  targetSamplesPerPixel: number,
): WaveformPeakLevel | undefined {
  if (pyramid.levels.length === 0) return undefined;
  const target = Math.max(1, targetSamplesPerPixel);
  let selected = pyramid.levels[0];
  for (const level of pyramid.levels) {
    if (level.samplesPerBin > target) break;
    selected = level;
  }
  return selected;
}

export function estimateWaveformPyramidBytes(pyramid: WaveformPeakPyramid): number {
  return pyramid.levels.reduce((total, level) => total + level.minMax.byteLength, 0);
}

/** Caller chooses the byte budget; no desktop/mobile default is hidden here. */
export function createWaveformPeakCache(maxBytes: number, maxEntries?: number) {
  return new ResourceCache<string, WaveformPeakPyramid>({
    maxBytes,
    maxEntries,
    estimateBytes: estimateWaveformPyramidBytes,
  });
}
