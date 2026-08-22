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
  startEngine(): Promise<void>;
  stopEngine(): Promise<void>;
  isEngineRunning(): boolean;
  play(): void;
  stop(): Promise<void>;
  isPlaying(): boolean;
  setPosition(absoluteTick: number): void;
  getCurrentTick(): number;
  setTempo(bpm: number): void;
  getTempo(): number;
  setMasterGain(gain: number): void;
  /** Lädt ein mono Float-Sample in einen nativen Voice-Slot (0..7). */
  loadVoiceSample(
    slot: number,
    data: Float32Array,
    sampleRate: number,
    rootNote: number
  ): Promise<void>;
  clearVoiceSample(slot: number): void;
  noteOn(note: number, velocity: number, slot: number, slice: number): void;
  noteOff(note: number): void;
  allNotesOff(): void;
  /** Geschätzte Ausgabe-Pufferlatenz in ms; -1 wenn unbekannt. */
  getOutputLatencyMs(): number;
  getDiagnosticStatus(): string;
  close(): Promise<void>;
}

/** Verbindlicher JS-Vertrag zu NativeAudioBridge.kt. */
export interface VibeCoreNativeBridge {
  isAvailable(): boolean;
  startEngine(): boolean;
  stopEngine(): void;
  isEngineRunning(): boolean;
  play(): void;
  stop(): void;
  isPlaying(): boolean;
  setTempo(bpm: number): void;
  getTempo(): number;
  setMasterGain(gain: number): void;
  setPosition(absoluteTick: number): void;
  getCurrentTick(): number;
  getLatencyMs(): number;
  getDiagnosticStatus(): string;
  voiceLoadSample(slot: number, data: Float32Array, sampleRate: number, rootNote: number): boolean;
  voiceClearSample(slot: number): void;
  voiceNoteOn(note: number, velocity: number, slot: number, slice: number): void;
  voiceNoteOff(note: number): void;
  voiceAllNotesOff(): void;
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