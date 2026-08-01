// VibeCore Sample Forge — Slice Engine.
//
// Slice data model + operations for sample chopping. Slices are normalized
// positions (0..1) with optional name, color, and Groove-compatible metadata.
// All operations are pure and deterministic — operate on slice arrays, not
// on audio buffers.
//
// Groove-compatible: a slice's position maps directly to a Step in a Groove
// Pattern. The scheduler's `triggerSampleRegion(partId, startNorm, endNorm)`
// plays a slice region through the part's channel strip.
//
// Transient detection reuses the existing detectTransients from sampleForge.ts.

import { detectTransients } from "@/lib/audio/sampleForge";
import type { PCM } from "@/lib/audio/sampleForge";

import type { Slice } from "@/lib/model";
export type { Slice };

let _sliceIdCounter = 0;
function nextSliceId(): string {
  _sliceIdCounter = (_sliceIdCounter + 1) >>> 0;
  return `sl_${_sliceIdCounter.toString(36)}`;
}

// ─── Auto Slice ───────────────────────────────────────────────────────────────

/** Auto-slice via transient detection. Returns sorted slice positions with
 *  names like "S1", "S2", etc. Capped to maxSlices. */
export function autoSlice(
  pcm: PCM,
  sensitivity = 0.5,
  maxSlices = 16,
  opts?: { namePrefix?: string; color?: string },
): Slice[] {
  const positions = detectTransients(pcm, sensitivity);
  // Always prepend 0 and filter near-duplicates
  const raw = [0, ...positions].filter((v) => v < 0.999);
  const cleaned: number[] = [];
  for (const p of raw) {
    if (!cleaned.length || p - cleaned[cleaned.length - 1] > 0.01) cleaned.push(p);
  }
  const trimmed = cleaned.slice(0, maxSlices);
  const prefix = opts?.namePrefix ?? "S";
  const color = opts?.color;
  return trimmed.map((pos, i) => ({
    id: nextSliceId(),
    start: pos,
    name: `${prefix}${i + 1}`,
    color,
    velocity: 100,
  }));
}

/** Equal-spaced slice (e.g., 16 equal slices for a loop). */
export function equalSlice(count: number, opts?: { namePrefix?: string; color?: string }): Slice[] {
  const n = Math.max(1, Math.min(128, Math.round(count)));
  const prefix = opts?.namePrefix ?? "S";
  const color = opts?.color;
  const out: Slice[] = [];
  for (let i = 0; i < n; i++) {
    out.push({
      id: nextSliceId(),
      start: i / n,
      name: `${prefix}${i + 1}`,
      color,
      velocity: 100,
    });
  }
  return out;
}

// ─── Manual Slice Operations ───────────────────────────────────────────────────

/** Add a manual slice at `posNorm`. Returns a new sorted array. */
export function addSlice(slices: Slice[], posNorm: number, name?: string, color?: string): Slice[] {
  const pos = Math.max(0, Math.min(0.999, posNorm));
  const out = slices.slice();
  out.push({
    id: nextSliceId(),
    start: pos,
    name: name ?? `S${out.length + 1}`,
    color,
    velocity: 100,
  });
  return out.sort((a, b) => a.start - b.start);
}

/** Merge two adjacent slices (by index) — removes the boundary between them. */
export function mergeSlices(slices: Slice[], idx: number): Slice[] {
  if (idx < 0 || idx >= slices.length - 1) return slices;
  const out = slices.slice();
  // Remove the slice at idx+1, keep the one at idx (it extends to the next boundary)
  out.splice(idx + 1, 1);
  return out;
}

/** Split a slice at `posNorm` (must be within the slice's range). */
export function splitSlice(slices: Slice[], idx: number, posNorm: number): Slice[] {
  if (idx < 0 || idx >= slices.length) return slices;
  const target = slices[idx];
  const next = slices[idx + 1];
  const pos = Math.max(target.start + 0.001, Math.min((next?.start ?? 1) - 0.001, posNorm));
  if (pos <= target.start) return slices;
  const out = slices.slice();
  out.splice(idx, 1,
    { ...target, end: pos },
    { id: nextSliceId(), start: pos, name: `${target.name ?? "S"}b`, color: target.color, velocity: target.velocity },
  );
  return out;
}

/** Move a slice boundary to a new position. */
export function moveSlice(slices: Slice[], idx: number, newPos: number): Slice[] {
  if (idx < 0 || idx >= slices.length) return slices;
  const prev = slices[idx - 1];
  const next = slices[idx + 1];
  const lo = prev ? prev.start + 0.001 : 0;
  const hi = next ? next.start - 0.001 : 0.999;
  const pos = Math.max(lo, Math.min(hi, newPos));
  const out = slices.slice();
  out[idx] = { ...out[idx], start: pos };
  return out.sort((a, b) => a.start - b.start);
}

/** Delete a slice by index. */
export function deleteSlice(slices: Slice[], idx: number): Slice[] {
  if (idx < 0 || idx >= slices.length) return slices;
  return slices.filter((_, i) => i !== idx);
}

/** Rename a slice. */
export function renameSlice(slices: Slice[], idx: number, name: string): Slice[] {
  if (idx < 0 || idx >= slices.length) return slices;
  return slices.map((s, i) => i === idx ? { ...s, name } : s);
}

/** Set slice color. */
export function colorSlice(slices: Slice[], idx: number, color: string): Slice[] {
  if (idx < 0 || idx >= slices.length) return slices;
  return slices.map((s, i) => i === idx ? { ...s, color } : s);
}

/** Set slice velocity. */
export function setSliceVelocity(slices: Slice[], idx: number, velocity: number): Slice[] {
  if (idx < 0 || idx >= slices.length) return slices;
  return slices.map((s, i) => i === idx ? { ...s, velocity: Math.max(1, Math.min(127, velocity)) } : s);
}

// ─── Slice → Region Mapping ───────────────────────────────────────────────────

/** Resolve a slice's playback region [startNorm, endNorm] given a slice array. */
export function sliceRegion(slices: Slice[], idx: number): { start: number; end: number } | null {
  if (idx < 0 || idx >= slices.length) return null;
  const s = slices[idx];
  const start = s.start;
  const end = s.end ?? (slices[idx + 1]?.start ?? 1);
  return { start: Math.max(0, start), end: Math.min(1, end) };
}

/** Get all slice regions as [start, end] pairs for visualization. */
export function allSliceRegions(slices: Slice[]): { start: number; end: number; name?: string; color?: string }[] {
  return slices.map((s, i) => ({
    start: s.start,
    end: s.end ?? (slices[i + 1]?.start ?? 1),
    name: s.name,
    color: s.color,
  }));
}

// ─── Groove Integration ────────────────────────────────────────────────────────

/** Convert slices to Groove Steps for a 16-step pattern.
 *  Each slice that falls on a step boundary gets activated with its velocity.
 *  This is the bridge from Sample Forge → Groove Pattern. */
export function slicesToSteps(slices: Slice[], stepCount = 16): {
  on: boolean; velocity: number; sliceIdx: number;
}[] {
  const steps = Array.from({ length: stepCount }, () => ({ on: false, velocity: 100, sliceIdx: -1 }));
  for (let i = 0; i < slices.length; i++) {
    const s = slices[i];
    const stepIdx = Math.floor(s.start * stepCount);
    if (stepIdx < stepCount) {
      steps[stepIdx] = { on: true, velocity: s.velocity ?? 100, sliceIdx: i };
    }
  }
  return steps;
}