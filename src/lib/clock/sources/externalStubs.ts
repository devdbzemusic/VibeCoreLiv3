// MIDI / Ableton Link source stubs — Phase 4 placeholders.
// Define the interface now so MasterClock and UI can target it without
// breaking once a real implementation lands. No side effects on import.

import { masterClock } from "../masterClock";
import { startMidiSync, stopMidiSync, getMidiSyncStatus } from "./midiSync";

export interface ExternalClockSource {
  start(): Promise<void>;
  stop(): void;
  isRunning(): boolean;
}

class StubSource implements ExternalClockSource {
  constructor(private label: string) {}
  async start() { /* no-op until Phase 4 */ console.info(`[${this.label}] stub start`); }
  stop() { /* no-op */ }
  isRunning() { return false; }
}

// Real MIDI clock receiver lives in ./midiSync (Web MIDI API). Re-exported
// here under the ExternalClockSource interface so existing import sites get
// the implementation without changing their imports (Band 4 §6.1 external sync).
export const midiSource: ExternalClockSource = {
  // startMidiSync returns MidiSyncStatus; ExternalClockSource.start expects void.
  start: () => startMidiSync().then(() => undefined),
  stop: () => { stopMidiSync(); },
  isRunning: () => getMidiSyncStatus().connected,
};
export const linkSource: ExternalClockSource = new StubSource("Link");

/** Called by adaptive sync when a downbeat is detected. */
export function pushAdaptiveDownbeat(audioTime: number) {
  masterClock.alignDownbeat(audioTime, 0);
}