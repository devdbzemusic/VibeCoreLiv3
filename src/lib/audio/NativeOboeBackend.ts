/**
 * NativeOboeBackend — JS-Client für die native Oboe-Engine.
 *
 * Spricht über window.VibeCoreNative (per @JavascriptInterface im Android-WebView
 * injiziert). Nur auf echtem Android-Gerät verfügbar. Im Browser wird diese
 * Klasse nie instanziiert (siehe createAudioBackend()).
 */
import type { AudioBackend, VibeCoreNativeBridge } from "./AudioBackend";
import { getDeviceTuning } from "./quality";

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
    // Geräte-Tuning (SynthMark) an die native Engine weiterreichen.
    const dev = getDeviceTuning();
    if (dev.isBigLittle) {
      try { this.native.configure(dev.framesPerBurst, dev.bigCpuIndex, true); }
      catch { /* configure optional — ignorieren */ }
    }
  }

  configure(framesPerBurst: number, bigCpuIndex: number, enableAdpf: boolean): void {
    this.native.configure(framesPerBurst, bigCpuIndex, enableAdpf);
  }

  async start(): Promise<void> {
    if (this.started) return;
    const r = this.native.start();
    if (r !== 0) throw new Error(`Oboe start fehlgeschlagen (code ${r})`);
    this.started = true;
  }

  async stop(): Promise<void> {
    if (!this.started) return;
    this.native.stop();
    this.started = false;
  }

  async loadSample(
    slot: number,
    data: Float32Array,
    frames: number,
    channels: number,
    sampleRate: number
  ): Promise<void> {
    const r = this.native.loadSample(slot, data, frames, channels, sampleRate);
    if (r !== 0) throw new Error(`loadSample slot ${slot} fehlgeschlagen (code ${r})`);
  }

  trigger(slot: number, semitones: number, velocity: number, loop: boolean): void {
    this.native.trigger(slot, semitones, velocity, loop);
  }

  setTempo(bpm: number): void { this.native.setTempo(bpm); }
  setMasterGain(gain: number): void { this.native.setMasterGain(gain); }

  getOutputLatencyMs(): number { return this.native.getLatencyMs(); }

  async close(): Promise<void> {
    await this.stop();
  }
}