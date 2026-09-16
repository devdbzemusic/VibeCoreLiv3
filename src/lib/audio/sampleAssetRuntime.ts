import type { Part } from "@/lib/model";
import { isNativeAudioPath } from "./nativeAudioRuntime";
import { decodeMonoAsset } from "./assetDecode";
import { decodeSampleFile, assignBufferToPart } from "./engine";
import { uploadNativeGrooveAsset, type NativeGrooveAssetUploadResult } from "@/lib/runtime/nativeGrooveAssets";

export interface PreparedSampleAsset {
  buffer: AudioBuffer;
  native: boolean;
  nativeUpload: NativeGrooveAssetUploadResult | null;
}

/**
 * Runtime-aware sample preparation boundary.
 *
 * Browser/WebAudio:
 *   decode through the existing audible engine cache.
 * Native/Oboe:
 *   decode through OfflineAudioContext, downmix to mono Float32 PCM and cold-load
 *   the authoritative Native Groove sample store. No audible WebAudio graph is
 *   created merely to decode/upload a sample.
 */
export async function prepareSampleAsset(
  part: Part,
  file: File,
  preferredSampleRate = 48000,
): Promise<PreparedSampleAsset> {
  if (!isNativeAudioPath()) {
    return {
      buffer: await decodeSampleFile(file),
      native: false,
      nativeUpload: null,
    };
  }

  const decoded = await decodeMonoAsset(file, preferredSampleRate);
  const nativeUpload = uploadNativeGrooveAsset(part, decoded.monoPcm, decoded.sampleRate);
  if (!nativeUpload.accepted) {
    throw new Error(nativeUpload.reason ?? `Native Groove sample upload failed for part ${part.id}`);
  }

  return {
    buffer: decoded.buffer,
    native: true,
    nativeUpload,
  };
}

/**
 * Assign an already-decoded buffer to the browser editor/cache only.
 *
 * This helper intentionally does not claim Native registration. Native PCM must
 * pass prepareSampleAsset()/uploadNativeGrooveAsset first. On Native this keeps
 * the AudioBuffer available to editor/waveform code without creating a second
 * renderer; assignBufferToPart itself is safe before WebAudio graph creation.
 */
export function retainSampleBufferForEditor(partId: number, buffer: AudioBuffer): void {
  assignBufferToPart(partId, buffer);
}
