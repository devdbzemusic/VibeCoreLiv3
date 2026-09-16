import type { Part } from "@/lib/model";
import { instrumentAuthorityForCategory } from "@/lib/instruments/sourceBoundary";

export const NATIVE_GROOVE_MAX_SAMPLES = 128;

export interface NativeGrooveAssetBridge {
  canLoad(): boolean;
  loadSample(sampleId: number, data: Float32Array, sampleRate: number): boolean;
  clearSample(sampleId: number): boolean;
  sampleLoaded(sampleId: number): boolean;
}

declare global {
  interface Window {
    VibeCoreGrooveAssets?: NativeGrooveAssetBridge;
  }
}

export interface NativeGrooveAssetRegistration {
  partId: number;
  sampleId: number;
  sampleRate: number;
  lengthFrames: number;
  registeredAtRevision: number;
}

export interface NativeGrooveAssetUploadResult {
  accepted: boolean;
  sampleId: number | null;
  reason?: string;
  registration?: NativeGrooveAssetRegistration;
}

/**
 * Stable v1 sample-id rule.
 *
 * The WebAudio engine already owns audible sample buffers by Part.id and Native
 * Groove supports 128 sample ids while the project exposes 16 parts. Reusing
 * Part.id therefore avoids a second persisted asset-id namespace. Only
 * sample-domain parts are eligible for Groove sample registration.
 */
export function nativeGrooveSampleIdForPart(part: Pick<Part, "id" | "category">): number | null {
  if (instrumentAuthorityForCategory(part.category) !== "sample-domain") return null;
  if (!Number.isInteger(part.id) || part.id < 0 || part.id >= NATIVE_GROOVE_MAX_SAMPLES) return null;
  return part.id;
}

class NativeGrooveAssetRegistry {
  private readonly registered = new Map<number, NativeGrooveAssetRegistration>();
  private revision = 0;

  markRegistered(part: Pick<Part, "id" | "category">, sampleRate: number, lengthFrames: number): NativeGrooveAssetRegistration | null {
    const sampleId = nativeGrooveSampleIdForPart(part);
    if (sampleId == null || sampleRate <= 0 || lengthFrames <= 0) return null;
    this.revision += 1;
    const registration: NativeGrooveAssetRegistration = {
      partId: part.id,
      sampleId,
      sampleRate: Math.round(sampleRate),
      lengthFrames: Math.round(lengthFrames),
      registeredAtRevision: this.revision,
    };
    this.registered.set(sampleId, registration);
    return registration;
  }

  markCleared(part: Pick<Part, "id" | "category">): void {
    const sampleId = nativeGrooveSampleIdForPart(part);
    if (sampleId == null) return;
    this.registered.delete(sampleId);
    this.revision += 1;
  }

  isRegistered(part: Pick<Part, "id" | "category">): boolean {
    const sampleId = nativeGrooveSampleIdForPart(part);
    return sampleId != null && this.registered.has(sampleId);
  }

  registrationForPart(part: Pick<Part, "id" | "category">): NativeGrooveAssetRegistration | null {
    const sampleId = nativeGrooveSampleIdForPart(part);
    return sampleId == null ? null : this.registered.get(sampleId) ?? null;
  }

  clearSession(): void {
    if (this.registered.size === 0) return;
    this.registered.clear();
    this.revision += 1;
  }

  snapshot(): { revision: number; registered: NativeGrooveAssetRegistration[] } {
    return {
      revision: this.revision,
      registered: Array.from(this.registered.values()).sort((a, b) => a.sampleId - b.sampleId),
    };
  }
}

/** Session-only registration truth. Project/Zustand remains asset ownership truth. */
export const nativeGrooveAssetRegistry = new NativeGrooveAssetRegistry();

export function getNativeGrooveAssetBridge(): NativeGrooveAssetBridge | null {
  if (typeof window === "undefined") return null;
  return window.VibeCoreGrooveAssets ?? null;
}

/**
 * Cold-load one mono PCM asset into the currently prepared Native Groove graph.
 * Registration truth is recorded only after the native side confirms both the
 * upload and the resulting loaded state.
 */
export function uploadNativeGrooveAsset(
  part: Pick<Part, "id" | "category">,
  monoPcm: Float32Array,
  sampleRate: number,
  bridge: NativeGrooveAssetBridge | null = getNativeGrooveAssetBridge(),
): NativeGrooveAssetUploadResult {
  const sampleId = nativeGrooveSampleIdForPart(part);
  if (sampleId == null) {
    return { accepted: false, sampleId: null, reason: "Part has no Native Groove sample-domain id" };
  }
  if (!bridge) {
    return { accepted: false, sampleId, reason: "VibeCoreGrooveAssets bridge unavailable" };
  }
  if (monoPcm.length <= 0 || sampleRate <= 0) {
    return { accepted: false, sampleId, reason: "PCM payload/sample rate invalid" };
  }
  if (!bridge.canLoad()) {
    return { accepted: false, sampleId, reason: "Native Groove stream is running; cold-load unavailable" };
  }
  if (!bridge.loadSample(sampleId, monoPcm, Math.round(sampleRate))) {
    return { accepted: false, sampleId, reason: "Native Groove loadSample rejected PCM payload" };
  }
  if (!bridge.sampleLoaded(sampleId)) {
    return { accepted: false, sampleId, reason: "Native Groove did not acknowledge loaded sample" };
  }

  const registration = nativeGrooveAssetRegistry.markRegistered(part, sampleRate, monoPcm.length);
  if (!registration) {
    return { accepted: false, sampleId, reason: "Session registry rejected successful native load" };
  }
  return { accepted: true, sampleId, registration };
}

export function clearNativeGrooveAsset(
  part: Pick<Part, "id" | "category">,
  bridge: NativeGrooveAssetBridge | null = getNativeGrooveAssetBridge(),
): boolean {
  const sampleId = nativeGrooveSampleIdForPart(part);
  if (sampleId == null || !bridge || !bridge.canLoad()) return false;
  if (!bridge.clearSample(sampleId)) return false;
  nativeGrooveAssetRegistry.markCleared(part);
  return true;
}
