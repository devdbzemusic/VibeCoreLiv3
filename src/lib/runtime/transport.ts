import { ensureAudio } from "@/lib/audio/engine";
import { activateNativeAudio } from "@/lib/audio/nativeAudioRuntime";
import { useGroove } from "@/lib/store";
import { selectedRuntimeKind } from "./selection";

/**
 * Single frontend entry point for transport play/pause preparation.
 *
 * Store transport remains the authoritative product state. Existing runtime
 * subscribers remain responsible for starting/stopping their platform
 * scheduler/engine after the state transition.
 */
export async function toggleRuntimePlay(): Promise<boolean> {
  const state = useGroove.getState();

  // Pause never needs to start/activate a renderer first. The existing runtime
  // subscribers observe this transition and stop the active transport.
  if (state.transport.playing) {
    state.togglePlay();
    return true;
  }

  if (selectedRuntimeKind() === "oboe-native") {
    if (!await activateNativeAudio()) return false;
  } else {
    // ensureAudio() creates/resumes the WebAudio context and updates audioReady.
    await ensureAudio();
  }

  useGroove.getState().togglePlay();
  return true;
}
