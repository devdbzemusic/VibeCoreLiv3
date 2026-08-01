// VibeCore Sync — MIDI Clock receiver (external sync, opt-in).
//
// Real implementation replacing the former Phase-4 stub. Uses the Web MIDI
// API (`navigator.requestMIDIAccess`) to follow an external MIDI clock:
//   • 24-PPQ timing clock (0xF8)  → tempo estimation + phase lock
//   • Start (0xFA)                → transport start from beat 0
//   • Continue (0xFB)             → resume from held position
//   • Stop (0xFC)                 → pause (capture held)
//   • Song Position Pointer (0xF2) → coarse seek (16th-note resolution)
//
// Tempo is estimated from the median inter-clock interval (24 clocks per
// quarter-note); phase is locked to MasterClock on each confident tick.
// Transport commands route through the store actions so the single scheduler
// remains the only timing authority — MIDI never triggers DSP directly.
//
// BOUNDARY (Band 4 §6.1 / §15): Web MIDI is unavailable on some UAs (e.g.
// iOS Safari without a polyfill). `startMidiSync` resolves to a documented
// `unavailable` status in that case and the internal clock stays the authority.
// No competing time base is ever created (Band 4 §16 — single global clock).

import { useGroove } from "@/lib/store";
import { masterClock } from "../masterClock";
import { getCtx } from "@/lib/audio/engine";

export interface MidiSyncStatus {
  available: boolean;
  connected: boolean;
  inputName: string | null;
  error: string | null;
}

type MidiAccess = MIDIAccess;
type MidiInput = MIDIInput;

const nav = (typeof navigator !== "undefined"
  ? (navigator as Navigator & { requestMIDIAccess?: () => Promise<MidiAccess> })
  : undefined);

const CLOCK = 0xf8;
const START = 0xfa;
const CONTINUE = 0xfb;
const STOP = 0xfc;
const SPP = 0xf2;

let midi: MidiAccess | null = null;
let input: MidiInput | null = null;
let lastClockAt = 0;
let clockIntervals: number[] = [];
let running = false;

function median(vals: number[]): number {
  if (!vals.length) return 0;
  const s = vals.slice().sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function handleMsg(e: MIDIMessageEvent) {
  if (!e.data || e.data.length < 1) return;
  const ctx = getCtx();
  const now = ctx?.currentTime ?? performance.now() / 1000;
  const status = e.data[0];

  if (status === CLOCK) {
    if (lastClockAt > 0) {
      const ioi = now - lastClockAt;
      if (ioi > 0) {
        clockIntervals.push(ioi);
        if (clockIntervals.length > 24) clockIntervals.shift();
        if (clockIntervals.length >= 6) {
          const med = median(clockIntervals);
          const bpm = 60 / (med * 24); // 24 clocks per quarter note
          if (Number.isFinite(bpm) && bpm >= 40 && bpm <= 300) {
            masterClock.setTempo(Math.round(bpm * 10) / 10, now);
            if (masterClock.getState().source !== "midi") masterClock.setSource("midi", now);
            useGroove.getState().setSyncStatus({ source: "midi", confidence: 0.9, externalActive: true });
          }
        }
      }
    }
    lastClockAt = now;
    return;
  }

  if (status === START) {
    useGroove.getState().setSyncStatus({ source: "midi", externalActive: true });
    if (masterClock.getState().source === "internal") masterClock.setSource("midi", now);
    masterClock.alignDownbeat(now, 0);
    // Start from beat 0 — rewind then play.
    useGroove.getState().resetTransport();
    useGroove.getState().togglePlay();
    return;
  }

  if (status === CONTINUE) {
    useGroove.getState().setSyncStatus({ source: "midi", externalActive: true });
    if (masterClock.getState().source === "internal") masterClock.setSource("midi", now);
    if (!useGroove.getState().transport.playing) useGroove.getState().togglePlay();
    return;
  }

  if (status === STOP) {
    if (useGroove.getState().transport.playing) useGroove.getState().togglePlay();
    useGroove.getState().setSyncStatus({ source: "midi", externalActive: false });
    return;
  }

  if (status === SPP && e.data.length >= 3) {
    // Song Position Pointer — in 16th-notes (MIDI semiquaver). Used as a
    // coarse seek within the current pattern's scenes (architecture boundary:
    // cross-pattern SPP mapping is out of scope for this workband).
    const lsb = e.data[1];
    const msb = e.data[2];
    const sixteenths = ((msb << 7) + lsb) & 0x3fff;
    const st = useGroove.getState();
    const pat = st.patterns[st.transport.currentPattern];
    if (pat && pat.scenes.length) {
      const sceneLen = pat.scenes[0]?.length ?? 16;
      const sceneIdx = Math.floor(sixteenths / sceneLen) % pat.scenes.length;
      const step = sixteenths % sceneLen;
      st.seekTo(sceneIdx, step);
    }
  }
}

/** Opt-in: start following an external MIDI clock. Resolves to a documented
 *  status when Web MIDI is unavailable. */
export async function startMidiSync(inputId?: string): Promise<MidiSyncStatus> {
  if (!nav?.requestMIDIAccess) {
    useGroove.getState().setSyncStatus({ error: "Web MIDI nicht verfügbar" });
    return { available: false, connected: false, inputName: null, error: "Web MIDI nicht verfügbar" };
  }
  try {
    midi = await nav.requestMIDIAccess();
    const inputs: MIDIInput[] = Array.from((midi.inputs as unknown as Map<string, MIDIInput>).values());
    if (!inputs.length) {
      useGroove.getState().setSyncStatus({ midiConnected: false, error: "Kein MIDI-Input" });
      return { available: true, connected: false, inputName: null, error: "Kein MIDI-Input" };
    }
    input = (inputId ? inputs.find((i) => i.id === inputId) : null) ?? inputs[0];
    input.onmidimessage = handleMsg;
    running = true;
    useGroove.getState().setSyncStatus({ midiConnected: true, source: "midi", externalActive: true, error: null });
    return { available: true, connected: true, inputName: input.name ?? null, error: null };
  } catch (e) {
    useGroove.getState().setSyncStatus({ midiConnected: false, error: (e as Error).message });
    return { available: true, connected: false, inputName: null, error: (e as Error).message };
  }
}

/** Stop following the external MIDI clock; return authority to the internal clock. */
export function stopMidiSync(): void {
  if (input) input.onmidimessage = null;
  input = null;
  if (midi) { try { (midi as MIDIAccess & { close?: () => void }).close?.(); } catch { /* ignore */ } }
  midi = null;
  clockIntervals = [];
  lastClockAt = 0;
  running = false;
  const ctx = getCtx();
  masterClock.setSource("internal", ctx?.currentTime ?? 0);
  useGroove.getState().setSyncStatus({
    source: "internal", midiConnected: false, externalActive: false, confidence: 1, error: null,
  });
}

export function getMidiSyncStatus(): MidiSyncStatus {
  return {
    available: !!nav?.requestMIDIAccess,
    connected: running,
    inputName: input?.name ?? null,
    error: null,
  };
}