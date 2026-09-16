import type { Part } from "@/lib/model";
import { isNativeAudioPath } from "./nativeAudioRuntime";
import { decodeMonoAsset } from "./assetDecode";
import { decodeSampleFile, assignBufferToPart } from "./engine";
import { uploadNativeGrooveAsset, type NativeGrooveAssetUploadResult } from "@/lib/runtime/nativeGrooveAssets";

export interface DecodedSampleAsset {
  buffer: AudioBuffer;
  native: boolean;
  monoPcm: Float32Array | null;
  sampleRate: number;
}

export interface SampleAssetAssignmentResult {
  assigned: boolean;
  native: boolean;
  nativeUpload: NativeGrooveAssetUploadResult | null;
}

/**
 * Decode a library/editor asset without implicitly assigning it to a Part.
 *
 * Browser/WebAudio uses the existing decoder/cache. Native/Oboe uses the
 * renderer-independent OfflineAudioContext path and keeps mono PCM alongside
 * the editor AudioBuffer for a later explicit Part assignment.
 */
export async function decodeSampleAsset(
  file: File,
  preferredSampleRate = 48000,
): Promise<DecodedSampleAsset> {
  if (!isNativeAudioPath()) {
    const buffer = await decodeSampleFile(file);
    return {
      buffer,
      native: false,
      monoPcm: null,
      sampleRate: buffer.sampleRate,
    };
  }

  const decoded = await decodeMonoAsset(file, preferredSampleRate);
  return {
    buffer: decoded.buffer,
    native: true,
    monoPcm: decoded.monoPcm,
    sampleRate: decoded.sampleRate,
  };
}

/**
 * Explicit assignment boundary. Merely browsing/loading a library item does not
 * mutate Native state. On Native, PCM must be cold-loaded and acknowledged
 * before the editor buffer is associated with the Part. On Browser, the current
 * WebAudio buffer assignment behavior is retained.
 */
export function assignSampleAssetToPart(
  part: Part,
  asset: DecodedSampleAsset,
): SampleAssetAssignmentResult {
  if (!asset.native) {
    assignBufferToPart(part.id, asset.buffer);
    return { assigned: true, native: false, nativeUpload: null };
  }

  if (!asset.monoPcm) {
    return { assigned: false, native: true, nativeUpload: null };
  }

  const nativeUpload = uploadNativeGrooveAsset(part, asset.monoPcm, asset.sampleRate);
  if (!nativeUpload.accepted) {
    return { assigned: false, native: true, nativeUpload };
  }

  // Keep the decoded AudioBuffer available to waveform/editor code. This does
  // not create an audible WebAudio graph when no AudioContext/PartChain exists.
  assignBufferToPart(part.id, asset.buffer);
  return { assigned: true, native: true, nativeUpload };
}
