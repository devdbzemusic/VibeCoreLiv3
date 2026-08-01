// VibeCore 3D Bass — Engine Integration.
//
// The single entry point called from engine.ts when a part uses the "3D Bass"
// synth engine. Creates the spatial chain, triggers the voice engine, and
// connects to the part's channel strip input.
//
// This function is the ONLY integration point between the 3D Bass and the
// Audio Engine. It receives the part's chain.input (the existing channel
// strip) and routes the 3D Bass's output through it — the Audio Engine's
// per-part HP/LP/Drive/EQ/volume/pan/sends/FX/master path is unchanged.

import type { Part } from "@/lib/model";
import { triggerNote3DBass } from "./voiceEngine";

/**
 * Trigger a 3D Bass note on a part's channel strip.
 * @param ctx         the AudioContext
 * @param chainInput  the part's chain.input GainNode (from engine.ts)
 * @param part        the part (must have synth.engine === "3D Bass")
 * @param when        audio-context time of note-on
 * @param opts        velocity (0..127), semitone (MIDI offset), gateSec (note duration)
 */
export async function trigger3DBass(
  ctx: AudioContext,
  chainInput: AudioNode,
  part: Part,
  when: number,
  opts: { velocity: number; semitone: number; gateSec: number },
): Promise<void> {
  triggerNote3DBass(ctx, chainInput, part, when, opts);
}