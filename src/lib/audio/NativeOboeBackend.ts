/**
 * NativeOboeBackend — JS-Client für die native Oboe-Engine.
 *
 * Spricht über window.VibeCoreNative (per @JavascriptInterface im Android-WebView
 * injiziert). Nur auf echtem Android-Gerät verfügbar. Im Browser wird diese
 * Klasse nie instanziiert (siehe createAudioBackend()).
 */
import type { AudioBackend, VibeCoreNativeBridge } from "./AudioBackend";

export class NativeOboeBackend implements AudioBackend {
  readonly kind = "oboe-native" as const;
  private native: VibeCoreNativeBridge;
  private started = false;

  constructor() {
    const n = window.VibeCoreNative;
    if (!n) throw new Error("NativeOboeBackend: window.VibeCoreNative fehlt");
    this.native = n;
  }

  async init(): Promise<void> {
    if (!this.native.isAvailable()) {
      throw new Error("NativeOboeBackend: native Engine ist nicht verfügbar");
    }
  }

  async startEngine(): Promise<void> {
    if (this.started) return;
    if (!this.native.startEngine()) {
      throw new Error(`Oboe start fehlgeschlagen (${this.native.getDiagnosticStatus()})`);
    }
    this.started = true;
  }

  async stopEngine(): Promise<void> {
    if (!this.started && !this.native.isEngineRunning()) return;
    this.native.voiceAllNotesOff();
    this.native.stop();
    this.native.stopEngine();
    this.started = false;
  }

  isEngineRunning(): boolean {
    return this.native.isEngineRunning();
  }

  play(): void {
    if (!this.isEngineRunning()) throw new Error("Oboe play ohne laufende Engine");
    this.native.play();
  }

  async stop(): Promise<void> {
    if (!this.started && !this.native.isEngineRunning()) return;
    this.native.voiceAllNotesOff();
    this.native.stop();
  }

  isPlaying(): boolean {
    return this.native.isPlaying();
  }

  setPosition(absoluteTick: number): void {
    this.native.setPosition(Math.max(0, Math.floor(absoluteTick)));
  }

  getCurrentTick(): number {
    return this.native.getCurrentTick();
  }

  async loadVoiceSample(
    slot: number,
    data: Float32Array,
    sampleRate: number,
    rootNote: number
  ): Promise<void> {
    if (!this.native.voiceLoadSample(slot, data, Math.round(sampleRate), Math.round(rootNote))) {
      throw new Error(`voiceLoadSample für Slot ${slot} fehlgeschlagen`);
    }
  }

  clearVoiceSample(slot: number): void {
    this.native.voiceClearSample(slot);
  }

  noteOn(note: number, velocity: number, slot: number, slice: number): void {
    this.native.voiceNoteOn(
      Math.max(0, Math.min(127, Math.round(note))),
      Math.max(0, Math.min(127, Math.round(velocity))),
      Math.max(-1, Math.min(7, Math.round(slot))),
      Math.max(-1, Math.round(slice))
    );
  }

  noteOff(note: number): void {
    this.native.voiceNoteOff(Math.max(0, Math.min(127, Math.round(note))));
  }

  allNotesOff(): void {
    this.native.voiceAllNotesOff();
  }

  setTempo(bpm: number): void { this.native.setTempo(bpm); }
  getTempo(): number { return this.native.getTempo(); }
  setMasterGain(gain: number): void { this.native.setMasterGain(gain); }

  getOutputLatencyMs(): number { return this.native.getLatencyMs(); }
  getDiagnosticStatus(): string { return this.native.getDiagnosticStatus(); }

  async close(): Promise<void> {
    await this.stopEngine();
  }
}