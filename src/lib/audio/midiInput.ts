// VibeCore — Web MIDI CC input for the modulation matrix.
//
// This adapter owns only controller input state. It never triggers audio
// directly: modulation.ts polls the latest normalized value for a route's
// selected CC number on its existing animation-frame loop.

import { setMidiCcInput } from "./modulation";

export interface MidiCcStatus {
  available: boolean;
  connected: boolean;
  inputCount: number;
  inputName: string | null;
  error: string | null;
}

type MidiAccess = MIDIAccess;
type MidiInput = MIDIInput;

const nav = (typeof navigator !== "undefined"
  ? (navigator as Navigator & { requestMIDIAccess?: () => Promise<MidiAccess> })
  : undefined);

const ccValues = new Float32Array(128);
ccValues.fill(0.5);

let midi: MidiAccess | null = null;
let inputs = new Map<string, MidiInput>();
let lastError: string | null = null;
let startPromise: Promise<MidiCcStatus> | null = null;
let learnResolve: ((cc: number) => void) | null = null;
let learnReject: ((error: Error) => void) | null = null;
let learnTimer: number | null = null;

function handleMessage(event: MIDIMessageEvent): void {
  const data = event.data;
  if (!data || data.length < 3) return;
  // MIDI CC messages use status 0xB0..0xBF (one channel per low nibble).
  if ((data[0] & 0xf0) !== 0xb0) return;

  const cc = data[1] & 0x7f;
  const value = (data[2] & 0x7f) / 127;
  ccValues[cc] = value;

  if (learnResolve) {
    const resolve = learnResolve;
    clearLearn();
    resolve(cc);
  }
}

function clearLearn(): void {
  if (learnTimer !== null) {
    window.clearTimeout(learnTimer);
    learnTimer = null;
  }
  learnResolve = null;
  learnReject = null;
}

function detachInputs(): void {
  inputs.forEach((input) => {
    input.removeEventListener("midimessage", handleMessage as EventListener);
  });
  inputs.clear();
}

function syncInputs(access: MidiAccess): void {
  detachInputs();
  const availableInputs = Array.from(
    (access.inputs as unknown as Map<string, MidiInput>).values(),
  );
  availableInputs.forEach((input) => {
    input.addEventListener("midimessage", handleMessage as EventListener);
    inputs.set(input.id, input);
  });
  lastError = availableInputs.length ? null : "Kein MIDI-Input";
}

function handleStateChange(): void {
  if (midi) syncInputs(midi);
}

function midiInputValues(): { values: Float32Array; read: (cc: number) => number } {
  return {
    values: ccValues,
    read: (cc: number) => ccValues[Math.max(0, Math.min(127, Math.floor(cc)))] ?? 0.5,
  };
}

// Keep the modulation runtime connected even before a device is opened. Its
// centred value is neutral for bipolar modulation routes.
setMidiCcInput(midiInputValues());

/** Request Web MIDI access and listen for CC messages from every input. */
export async function startMidiInput(): Promise<MidiCcStatus> {
  if (startPromise) return startPromise;
  startPromise = (async () => {
    if (!nav?.requestMIDIAccess) {
      lastError = "Web MIDI nicht verfügbar";
      return { available: false, connected: false, inputCount: 0, inputName: null, error: lastError };
    }
    try {
      if (midi) midi.removeEventListener("statechange", handleStateChange as EventListener);
      midi = await nav.requestMIDIAccess();
      syncInputs(midi);
      midi.addEventListener("statechange", handleStateChange as EventListener);
      return {
        available: true,
        connected: inputs.size > 0,
        inputCount: inputs.size,
        inputName: inputs.values().next().value?.name ?? null,
        error: lastError,
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : "MIDI-Zugriff fehlgeschlagen";
      return { available: true, connected: false, inputCount: 0, inputName: null, error: lastError };
    } finally {
      startPromise = null;
    }
  })();
  return startPromise;
}

/**
 * Wait for the next incoming CC number. The caller is responsible for
 * persisting the returned number on the selected ModRoute.
 */
export async function learnNextMidiCC(timeoutMs = 10000): Promise<number> {
  const status = await startMidiInput();
  if (!status.connected) {
    throw new Error(status.error ?? "Kein MIDI-Input");
  }
  if (learnResolve) clearLearn();

  return new Promise<number>((resolve, reject) => {
    learnResolve = resolve;
    learnReject = reject;
    learnTimer = window.setTimeout(() => {
      const rejectLearn = learnReject;
      clearLearn();
      rejectLearn?.(new Error("MIDI Learn timeout"));
    }, timeoutMs);
  });
}

/** Cancel an active Learn operation, for example when the editor closes. */
export function cancelMidiLearn(): void {
  const reject = learnReject;
  clearLearn();
  reject?.(new Error("MIDI Learn cancelled"));
}

export function getMidiCcStatus(): MidiCcStatus {
  return {
    available: !!nav?.requestMIDIAccess,
    connected: inputs.size > 0,
    inputCount: inputs.size,
    inputName: inputs.values().next().value?.name ?? null,
    error: lastError,
  };
}

/** Release MIDI listeners when the host application is shutting down. */
export function stopMidiInput(): void {
  cancelMidiLearn();
  detachInputs();
  if (midi) {
    midi.removeEventListener("statechange", handleStateChange as EventListener);
    try { (midi as MIDIAccess & { close?: () => void }).close?.(); } catch { /* ignore */ }
  }
  midi = null;
  startPromise = null;
}