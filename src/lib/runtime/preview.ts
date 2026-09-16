import { ensureAudio, previewBuffer, triggerSampleRegion } from "@/lib/audio/engine";
import { probeRuntimeCapability } from "@/lib/capabilities/registry";
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
 * Query preview capability without initializing any renderer. Availability is
 * owned by the central Capability Registry; RuntimePreview only interprets the
 * selected renderer.
 */
export function runtimePreviewCapability(): RuntimePreviewCapability {
  const runtime = selectedRuntimeKind();
  const capability = probeRuntimeCapability(
    runtime === "oboe-native" ? "preview.buffer.native" : "preview.buffer.web",
  );
  return {
    available: capability.available,
    runtime,
    reason: capability.reason,
  };
}

/**
 * Audition an arbitrary AudioBuffer without allowing Native Android to silently
 * start an audible WebAudio renderer.
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
 * strip. Browser reuses triggerSampleRegion; Native remains unavailable until
 * the Capability Registry can expose a source-proven native region-preview path.
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
      reason: capability.reason,
    };
  }

  await ensureAudio();
  triggerSampleRegion(partId, startNorm, endNorm, velocity);
  return { accepted: true, runtime: "webaudio" };
}
