import { ResourceCache } from "./resourceCache";

export interface AnalysisCacheIdentity {
  audioHash: string;
  algorithm: string;
  algorithmVersion: string | number;
  settingsHash: string;
}

export interface AnalysisCacheEntry<T> {
  identity: AnalysisCacheIdentity;
  value: T;
  /** Optional explicit payload estimate supplied by the analysis module. */
  estimatedBytes?: number;
}

export function analysisCacheKey(identity: AnalysisCacheIdentity): string {
  return [
    identity.audioHash,
    identity.algorithm,
    String(identity.algorithmVersion),
    identity.settingsHash,
  ].map((part) => encodeURIComponent(part)).join("|");
}

/**
 * Versioned analysis cache. Algorithm/settings identity is part of the key so
 * changed BPM/key/transient logic cannot silently reuse stale results.
 */
export function createAnalysisCache<T>(maxBytes: number, maxEntries?: number) {
  return new ResourceCache<string, AnalysisCacheEntry<T>>({
    maxBytes,
    maxEntries,
    estimateBytes: (entry) => Math.max(0, Math.ceil(entry.estimatedBytes ?? 0)),
  });
}

export function putAnalysis<T>(
  cache: ResourceCache<string, AnalysisCacheEntry<T>>,
  entry: AnalysisCacheEntry<T>,
): string {
  const key = analysisCacheKey(entry.identity);
  cache.set(key, entry);
  return key;
}

export function getAnalysis<T>(
  cache: ResourceCache<string, AnalysisCacheEntry<T>>,
  identity: AnalysisCacheIdentity,
): AnalysisCacheEntry<T> | undefined {
  return cache.get(analysisCacheKey(identity));
}
