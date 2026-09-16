import { ensureAudio, previewBuffer, triggerSampleRegion } from "@/lib/audio/engine";
import { selectedRuntimeKind } from "./selection";

export interface RuntimePreviewResult {
  accepted: boolean;
  runtime: "webaudio" | "oboe-native";
  reason?: string;
}

export interface RuntimePreviewCapability {
  available: boolean;
  runtime: "webaudio" | "oboe-native";
  reason?: string;
}

/**
 * Query preview capability without initializing any renderer. UI modules use
 * this before render/decode work that would otherwise call ensureAudio().
 */
export function runtimePreviewCapability(): RuntimePreviewCapability {
  const runtime = selectedRuntimeKind();
  if (runtime === "oboe-native") {
    return {
      available: false,
      runtime,
      reason: "Native preview buffer contract is not implemented yet",
    };
  }
  return { available: true, runtime: "webaudio" };
}

/**
 * Audition an arbitrary AudioBuffer without allowing Native Android to silently
 * start an audible WebAudio renderer.
 *
 * Native preview is intentionally unsupported until a dedicated preview buffer
 * contract exists. The existing Voice engine owns all 8 sample slots; no slot
 * is reserved for audition and RuntimePreview must not overwrite user Voice data.
 */
export async function runtimePreviewBuffer(
  buffer: AudioBuffer,
  startNorm = 0,
  endNorm = 1,
): Promise<RuntimePreviewResult> {
  const capability = runtimePreviewCapability();
  if (!capability.available) {
    return {
      accepted: false,
      runtime: capability.runtime,
      reason: capability.reason,
    };
  }

  await ensureAudio();
  previewBuffer(buffer, startNorm, endNorm);
  return { accepted: true, runtime: "webaudio" };
}

/**
 * Audition the current buffer region of a Part through its existing channel
 * strip. Browser reuses triggerSampleRegion; Native is blocked until a proven
 * native sample-preview/region command exists.
 */
export async function runtimePreviewPartRegion(
  partId: number,
  startNorm: number,
  endNorm: number,
  velocity = 110,
): Promise<RuntimePreviewResult> {
  const capability = runtimePreviewCapability();
  if (!capability.available) {
    return {
      accepted: false,
      runtime: capability.runtime,
      reason: "Native part-region preview contract is not implemented yet",
    };
  }

  await ensureAudio();
  triggerSampleRegion(partId, startNorm, endNorm, velocity);
  return { accepted: true, runtime: "webaudio" };
}
