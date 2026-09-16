import type { Part } from "@/lib/model";
import { instrumentAuthorityForCategory } from "@/lib/instruments/sourceBoundary";

export const NATIVE_GROOVE_MAX_SAMPLES = 128;

export interface NativeGrooveAssetRegistration {
  partId: number;
  sampleId: number;
  sampleRate: number;
  lengthFrames: number;
  registeredAtRevision: number;
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
