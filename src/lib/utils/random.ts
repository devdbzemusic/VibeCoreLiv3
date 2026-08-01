// Deterministic PRNG — replaces Math.random() in pattern-affecting code
// (AI Scene Builder, probability, humanize, granular spray, random modulation).
// Same seed → identical output. mulberry32 is fast, has a 2^32 period,
// and passes BigCrush for most practical uses.

export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a 32-bit hash of two integers — used to derive per-scope seeds. */
export function hashSeed(a: number, b: number): number {
  let h = (a >>> 0) ^ 0x811c9dc5;
  h = Math.imul(h ^ (b >>> 0), 0x01000193);
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  return (h ^ (h >>> 15)) >>> 0;
}

/** Convenience: range int [min, max]. */
export function randInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

/** Convenience: range float [min, max). */
export function randRange(rng: Rng, min: number, max: number): number {
  return min + rng() * (max - min);
}

/** Convenience: signed -1..+1. */
export function randSigned(rng: Rng): number {
  return rng() * 2 - 1;
}
