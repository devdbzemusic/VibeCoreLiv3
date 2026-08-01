// Sprint 6A — hardware enumeration helpers.
// Pure browser-API wrappers, defensive against unsupported environments.

export interface AudioDeviceInfo { id: string; label: string; kind: "input" | "output"; }
export interface MidiDeviceInfo { id: string; name: string; manufacturer: string; }

export async function listAudioDevices(): Promise<AudioDeviceInfo[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  try {
    // A getUserMedia call is needed to get labels in most browsers.
    try { await navigator.mediaDevices.getUserMedia({ audio: true }); } catch { /* ignore */ }
    const list = await navigator.mediaDevices.enumerateDevices();
    return list
      .filter((d) => d.kind === "audioinput" || d.kind === "audiooutput")
      .map((d, i) => ({
        id: d.deviceId || `dev-${i}`,
        label: d.label || (d.kind === "audioinput" ? `Input ${i + 1}` : `Output ${i + 1}`),
        kind: d.kind === "audioinput" ? "input" : "output",
      }));
  } catch {
    return [];
  }
}

export async function listMidiDevices(): Promise<{ inputs: MidiDeviceInfo[]; outputs: MidiDeviceInfo[] }> {
  const nav = navigator as Navigator & { requestMIDIAccess?: () => Promise<MIDIAccess> };
  if (!nav.requestMIDIAccess) return { inputs: [], outputs: [] };
  try {
    const access = await nav.requestMIDIAccess();
    const inputs: MidiDeviceInfo[] = [];
    const outputs: MidiDeviceInfo[] = [];
    access.inputs.forEach((p) => inputs.push({ id: p.id, name: p.name ?? "Input", manufacturer: p.manufacturer ?? "" }));
    access.outputs.forEach((p) => outputs.push({ id: p.id, name: p.name ?? "Output", manufacturer: p.manufacturer ?? "" }));
    return { inputs, outputs };
  } catch {
    return { inputs: [], outputs: [] };
  }
}

// Minimal MIDI typings to avoid extra deps
interface MIDIAccess {
  inputs: Map<string, MIDIPort>;
  outputs: Map<string, MIDIPort>;
}
interface MIDIPort { id: string; name?: string; manufacturer?: string; }
