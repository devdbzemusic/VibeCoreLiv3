// VibeCore — Central Voice-Allocation & Stealing Policy.
//
// Single source of truth for who gets a voice and who is stolen when the
// engine is full. Every sound module — drum sampler, GravLace bass, synth
// lead, central arp, granular textures — enters through `triggerPart`, which
// calls `requestVoice()` here. No module decides allocation on its own, so
// they all speak one priority language and never fight over the voice budget.
//
// ── Policy ────────────────────────────────────────────────────────────────
//   1. Priority tiers (lower number = more critical, never stolen by a
//      less-critical module):
//        CRITICAL 0  — Bass (GravLace), Kick
//        HIGH     1  — Lead, Drum kit
//        MEDIUM   2  — Arp notes, one-shot samples
//        LOW      3  — Granular textures, Pads, reverb tails
//   2. Cap comes from the adaptive quality profile (set via setVoiceCap).
//   3. On a full engine, steal the oldest voice whose priority is >= the
//      requester's. A more-critical voice is never stolen → bass/drums stay
//      rock-solid when pads/granular pile up.
//   4. If every active voice is more critical than the requester, the new
//      note is dropped (protects the groove) — recorded as a dropped voice.
//   5. Stealing is a fast fade (~12 ms) on the victim's note gains, not a
//      hard cut — no clicks, block-accurate, no shared-state writes.
//
// This module owns only the allocation decision; per-node tracking for
// transport flush / meters stays in the engine. The two counts are
// intentionally separate: notes (here) vs. live nodes (engine).

import type { Part } from "@/lib/model";

export type VoiceModule = "drum" | "bass" | "lead" | "arp" | "pad" | "granular" | "fx";

export const VoicePriority = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
} as const;
export type VoicePriorityLevel = (typeof VoicePriority)[keyof typeof VoicePriority];

export interface VoiceHandle {
  readonly id: number;
  /** Register the fast-fade that silences this note's voices (invoked on steal). */
  steal: (fadeFn: (fadeSec: number) => void) => void;
  /** Mark the note finished — frees its slot. Idempotent. */
  release: () => void;
}

interface Entry {
  id: number;
  partId: number;
  module: VoiceModule;
  priority: VoicePriorityLevel;
  born: number;
  fade: (fadeSec: number) => void;
}

const STEAL_FADE_SEC = 0.012;

let cap = 96;
const voices = new Map<number, Entry>();
let nextId = 1;
const listeners = new Set<(activeNotes: number) => void>();

export function setVoiceCap(n: number): void { cap = Math.max(1, Math.round(n)); }
export function activeNoteCount(): number { return voices.size; }
export function subscribeActiveNotes(cb: (n: number) => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}
function notify(): void { const n = voices.size; listeners.forEach((cb) => cb(n)); }
function evict(id: number): void { if (voices.delete(id)) notify(); }

function grant(partId: number, module: VoiceModule, priority: VoicePriorityLevel): VoiceHandle {
  const id = nextId++;
  const entry: Entry = { id, partId, module, priority, born: now(), fade: () => {} };
  voices.set(id, entry);
  notify();
  let released = false;
  return {
    id,
    steal: (fn) => { entry.fade = fn; },
    release: () => { if (released) return; released = true; evict(id); },
  };
}

function now(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

export function requestVoice(
  partId: number,
  module: VoiceModule,
  priority: VoicePriorityLevel,
): VoiceHandle | null {
  if (voices.size < cap) return grant(partId, module, priority);

  // Engine full → steal the best victim: lowest priority (highest number),
  // then oldest. Never steal a voice more critical than the requester.
  let victim: Entry | null = null;
  for (const v of voices.values()) {
    if (v.priority < priority) continue; // protected
    if (!victim) { victim = v; continue; }
    if (v.priority > victim.priority) victim = v;
    else if (v.priority === victim.priority && v.born < victim.born) victim = v;
  }
  if (!victim) return null; // all active voices are more critical → drop new note

  victim.fade(STEAL_FADE_SEC);
  evict(victim.id);
  return grant(partId, module, priority);
}

/** Classify a part into (module, priority) so every module shares one
 *  priority language — no per-module hard-coding, no manual tuning. */
export function partVoiceClass(part: Part): { module: VoiceModule; priority: VoicePriorityLevel } {
  const w = part?.wave;
  if (w && (w.granEnabled || w.freeze || w.granFreeze)) {
    return { module: "granular", priority: VoicePriority.LOW };
  }
  const src = part?.source ?? "sample";
  if (src === "synth") {
    const eng = part?.synth?.engine;
    if (eng === "Bass" || eng === "3D Bass") return { module: "bass", priority: VoicePriority.CRITICAL };
    if (eng === "3D") return { module: "lead", priority: VoicePriority.HIGH };
    if (eng === "Pad") return { module: "pad", priority: VoicePriority.LOW };
    return { module: "lead", priority: VoicePriority.HIGH };
  }
  // samples / hybrid → drum kit (short tails, high priority)
  return { module: "drum", priority: VoicePriority.HIGH };
}