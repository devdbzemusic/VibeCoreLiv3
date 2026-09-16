import { probeRuntimeCapability } from "@/lib/capabilities/registry";
import type { RuntimeBackendInfo, RuntimeKind } from "./types";

/**
 * Single frontend owner for audible runtime selection.
 *
 * Selection is side-effect free and now delegates environment availability to
 * the Capability Registry. Actual activation still belongs to the runtime
 * backend and may fail independently; selection must never be treated as proof
 * that audio has started successfully.
 */
export function selectedRuntimeKind(): RuntimeKind {
  return probeRuntimeCapability("audio.native").available ? "oboe-native" : "webaudio";
}

export function runtimeSelectionInfo(): RuntimeBackendInfo {
  const kind = selectedRuntimeKind();
  const capability = probeRuntimeCapability(kind === "oboe-native" ? "audio.native" : "audio.web");
  return {
    kind,
    available: capability.available,
    active: false,
    diagnostic: capability.reason ?? (kind === "oboe-native" ? "selected:native-oboe" : "selected:browser-webaudio"),
  };
}
