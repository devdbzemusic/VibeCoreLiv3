import { isNativeAudioPath } from "@/lib/audio/nativeAudioRuntime";
import type { RuntimeBackendInfo, RuntimeKind } from "./types";

/**
 * Single frontend owner for runtime-kind selection.
 *
 * This does not activate audio and intentionally has no side effects. It is the
 * only place new runtime-facing UI code should ask which audible renderer is
 * selected. Adapter creation/activation is layered on top in the next slice.
 */
export function selectedRuntimeKind(): RuntimeKind {
  return isNativeAudioPath() ? "oboe-native" : "webaudio";
}

export function runtimeSelectionInfo(): RuntimeBackendInfo {
  const kind = selectedRuntimeKind();
  return {
    kind,
    available: true,
    active: false,
    diagnostic: kind === "oboe-native" ? "selected:native-oboe" : "selected:browser-webaudio",
  };
}
