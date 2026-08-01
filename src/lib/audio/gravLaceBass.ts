// VibeCore GravLace Bass — VibeCoreLiv3.
//
// GravLace engine architecture (per VibeCore Sync spec):
//
//   Keyboard → Chord Detector → Arp Engine → SceneStep Mapper
//     → Bass Voice Allocator → Event Generator → GravLace DSP → 3D Space
//
//   E_ARP_NOTE → Voice Allocator → E_LACE → E_TRANSIENT_GATE → E_WARPER_MICRO → DSP
//
// The shared ArpEngine + scheduler already apply the SceneStep-level coupling:
//   • LaceDensity   → ratchet count (multiple triggerPart calls / sub-offsets)
//   • GateIntensity → gateSec (note length)
//   • WarperChance  → micro-timing offset
//
// This module is the per-voice DSP layer those events land on. It does NOT
// touch the clock or shared state — every texture arises from the trigger
// params, so the engine stays deterministic and block-accurate:
//   • E_LACE           → layered, slightly detuned oscillators (texture density)
//   • E_TRANSIENT_GATE → tight transient envelope (pluck ↔ sustain)
//   • E_WARPER_MICRO   → FM pitch warper (micro detune wobble, no amp LFO)
//
// Integration: invoked from `triggerSynth` for engine === "Bass", which is
// itself called by `triggerPart` — so the shared arp, the adaptive quality
// voice-cap and the per-part channel strip (drive/EQ/sends/pan/master) all
// apply unchanged. No new model fields: behaviour maps onto the existing
// SynthParams `b*` controls so stored projects keep working.

import type { SynthParams } from "@/lib/model";
import { MIDI_A4, semiToHz } from "@/lib/dsp";

export function triggerGravLaceBass(
  c: AudioContext,
  dest: AudioNode,
  s: SynthParams,
  when: number,
  vel: number,
  semi: number,
  gateSec: number,
): void {
  const out = c.createGain();
  out.gain.value = 1;
  out.connect(dest);

  // Bass register — matches the previous voiceBass anchor (semi - 33) so
  // existing bass patterns / arp root notes land in the same octave.
  const root = Math.max(20, semiToHz(MIDI_A4, semi - 33));

  // ── E_LACE: layered detuned oscillators (texture density) ──────────────
  // 3-voice lace: two detuned saws + one square. bOsc morphs saw-heavy ↔
  // square-heavy and widens the lace spread (denser texture as it rises).
  const LACE = 3;
  const oscMix = c.createGain();
  oscMix.gain.value = 1 / LACE;
  const oscs: OscillatorNode[] = [];
  for (let i = 0; i < LACE; i++) {
    const o = c.createOscillator();
    o.type = i === LACE - 1 ? "square" : "sawtooth";
    o.frequency.value = root;
    const sign = i === 0 ? -1 : i === 1 ? 1 : 0;
    o.detune.value = sign * (4 + (s.bOsc / 100) * 16); // ±4..20 cents
    const g = c.createGain();
    // square voice level follows bOsc; the two saws carry the rest of the lace.
    g.gain.value = i === LACE - 1 ? (s.bOsc / 100) * 0.5 : 1 - s.bOsc / 200;
    o.connect(g).connect(oscMix);
    oscs.push(o);
  }

  // ── Sub anchor — keeps the low end constant under the lace texture ─────
  const sub = c.createOscillator();
  sub.type = "sine";
  sub.frequency.value = root / 2;
  const subG = c.createGain();
  subG.gain.value = (s.bSub / 100) * 0.7;
  sub.connect(subG);

  // ── E_WARPER_MICRO: FM pitch warper ─────────────────────────────────────
  // A sub-audio modulator pushes the lace + sub frequencies → a micro pitch
  // wobble that keeps the timbre alive without an amp LFO (stays block-free).
  // Depth tracks bFm so harder arp notes (higher coupling) warp more.
  const warper = c.createOscillator();
  warper.type = "sine";
  warper.frequency.value = 4 + (s.bFm / 100) * 24; // 4..28 Hz
  const warperG = c.createGain();
  warperG.gain.value = (s.bFm / 100) * root * 1.5;
  warper.connect(warperG);
  oscs.forEach((o) => warperG.connect(o.frequency));
  warperG.connect(sub.frequency);

  // ── Filter ─────────────────────────────────────────────────────────────
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 200 + (s.bFilter / 100) * 6000;
  lp.Q.value = 6;
  oscMix.connect(lp);
  subG.connect(lp);

  // ── Glide (macro warper: pitch slide on note-on) ───────────────────────
  if (s.bGlide > 0) {
    const gtime = (s.bGlide / 100) * 0.4;
    oscs.forEach((o) => {
      o.frequency.setValueAtTime(root * 0.5, when);
      o.frequency.exponentialRampToValueAtTime(root, when + gtime);
    });
  }

  // ── E_TRANSIENT_GATE: amp envelope ──────────────────────────────────────
  // bDecay shapes the transient tightness; gateSec (from arp GateIntensity)
  // sets the sustain length. 5 ms attack avoids a click; setTarget release
  // gives a clean tail without scheduling a hard stop mid-buffer.
  const decay = 0.05 + (s.bDecay / 100) * 1.5;
  const env = c.createGain();
  const v = Math.max(0.0001, vel);
  env.gain.setValueAtTime(0.0001, when);
  env.gain.exponentialRampToValueAtTime(v, when + 0.005);
  env.gain.setTargetAtTime(v * 0.5, when + 0.02, decay * 0.4);
  const end = when + Math.max(gateSec, 0.1);
  env.gain.setTargetAtTime(0.0001, end, 0.05);
  lp.connect(env).connect(out);

  // ── Lifecycle ──────────────────────────────────────────────────────────
  oscs.forEach((o) => o.start(when));
  sub.start(when);
  warper.start(when);
  const stopAt = end + 0.3;
  oscs.forEach((o) => o.stop(stopAt));
  sub.stop(stopAt);
  warper.stop(stopAt);
}