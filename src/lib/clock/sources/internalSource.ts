// Internal clock source — bridges store.bpm into MasterClock.
// Activated once at app boot. Additive: MasterClock starts at the store BPM
// and follows future changes via zustand subscribe. No existing behaviour is
// altered — modules that ignore MasterClock keep working from store.bpm.

import { useGroove } from "@/lib/store";
import { getCtx, ensureAudio } from "@/lib/audio/engine";
import { masterClock } from "../masterClock";

let bound = false;

function registerOutputLatency(c: AudioContext) {
  const base = (c.baseLatency ?? 0);
  const out = (c as AudioContext & { outputLatency?: number }).outputLatency ?? 0;
  masterClock.setOutputLatency(base + out);
}

export function bindInternalSource() {
  if (bound) return;
  bound = true;
  // Seed
  const initial = useGroove.getState().bpm;
  const ctx = getCtx();
  masterClock.setTempo(initial, ctx?.currentTime ?? 0);
  // Follow BPM changes
  let prev = initial;
  useGroove.subscribe((s) => {
    if (s.bpm !== prev) {
      prev = s.bpm;
      const c = getCtx();
      masterClock.setTempo(s.bpm, c?.currentTime ?? 0);
    }
  });
  // Ensure clock anchor is in audio-time once the context is live
  ensureAudio().then((c) => {
    masterClock.setTempo(useGroove.getState().bpm, c.currentTime);
    registerOutputLatency(c);
    // outputLatency may populate late on some UAs — re-read shortly after.
    window.setTimeout(() => { const ctx = getCtx(); if (ctx) registerOutputLatency(ctx); }, 500);
  }).catch(() => { /* ignore */ });
}