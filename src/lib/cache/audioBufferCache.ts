import { ResourceCache } from "./resourceCache";

export type AudioAssetCacheKey = string | number;

/** PCM payload estimate only; browser/engine object overhead is intentionally not guessed. */
export function estimateAudioBufferBytes(buffer: AudioBuffer): number {
  return Math.max(0, buffer.length) * Math.max(1, buffer.numberOfChannels) * 4;
}

/**
 * Create an AudioBuffer cache with an explicit caller-selected memory budget.
 * No global default is imposed because device memory/quality policy must choose
 * the budget deliberately (Android and desktop must not silently share one).
 */
export function createAudioBufferCache(maxBytes: number, maxEntries?: number) {
  return new ResourceCache<AudioAssetCacheKey, AudioBuffer>({
    maxBytes,
    maxEntries,
    estimateBytes: estimateAudioBufferBytes,
  });
}
