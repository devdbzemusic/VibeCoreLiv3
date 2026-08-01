/**
 * AudioBackend — swappable Backend-Interface.
 *
 * Die Web-App bleibt Sequenz-Source-of-Truth. Das Backend übernimmt den
 * Render-Pfad. Zwei Implementierungen:
 *   - "webaudio"  : bestehende Web-Audio-Engine (default, läuft im Browser)
 *   - "oboe-native": native Oboe-Engine via window.VibeCoreNative (nur im
 *                   gepackten Android-WebView; dort niedrigste Latenz über
 *                   AAudio/OpenSL ES).
 *
 * Der native Pfad wird ausschließlich durch das Vorhandensein von
 * `window.VibeCoreNative` aktiviert — der Web-Audio-Code bleibt unangetastet.
 */
export type AudioBackendKind = "webaudio" | "oboe-native";

export interface AudioBackend {
  readonly kind: AudioBackendKind;
  init(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  /** Lädt ein Sample in einen Slot (0..63). Interleaved float, 1 oder 2 Kanäle. */
  loadSample(
    slot: number,
    data: Float32Array,
    frames: number,
    channels: number,
    sampleRate: number
  ): Promise<void>;
  /** Triggert eine Stimme auf dem Slot. semitones relativ zum Originalpitch. */
  trigger(slot: number, semitones: number, velocity: number, loop: boolean): void;
  setTempo(bpm: number): void;
  setMasterGain(gain: number): void;
  /** Geschätzte Ausgabe-Pufferlatenz in ms; -1 wenn unbekannt. */
  getOutputLatencyMs(): number;
  /** Geräte-Tuning (SynthMark): Burst-Größe, Big-Core-Index, ADPF. */
  configure(framesPerBurst: number, bigCpuIndex: number, enableAdpf: boolean): void;
  close(): Promise<void>;
}

export interface VibeCoreNativeBridge {
  isAvailable(): boolean;
  start(): number;           // 0 = ok, -1 = Fehler
  stop(): void;
  setTempo(bpm: number): void;
  setMasterGain(gain: number): void;
  loadSample(slot: number, data: Float32Array, frames: number, channels: number, sampleRate: number): number;
  trigger(slot: number, semitones: number, velocity: number, loop: boolean): void;
  getLatencyMs(): number;
  configure(framesPerBurst: number, bigCpuIndex: number, enableAdpf: boolean): number;
}

declare global {
  interface Window {
    VibeCoreNative?: VibeCoreNativeBridge;
  }
}

export function isNativeOboeAvailable(): boolean {
  return typeof window !== "undefined" && !!window.VibeCoreNative?.isAvailable?.();
}

import { NativeOboeBackend } from "./NativeOboeBackend";

/**
 * Fabrik: wählt automatisch das native Oboe-Backend, wenn die Brücke vorhanden
 * ist, sonst null (Aufrufer nutzt dann die bestehende Web-Audio-Engine).
 */
export function createAudioBackend(): AudioBackend | null {
  if (isNativeOboeAvailable()) return new NativeOboeBackend();
  return null; // Fallback: Web-Audio-Engine bleibt unangetastet verantwortlich.
}