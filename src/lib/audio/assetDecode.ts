export interface DecodedMonoAsset {
  buffer: AudioBuffer;
  monoPcm: Float32Array;
  sampleRate: number;
  lengthFrames: number;
}

/**
 * Downmix an AudioBuffer to mono Float32 PCM without mutating the source.
 * Equal channel weighting is deterministic and keeps the output within the
 * source range when channel samples are individually normalized.
 */
export function audioBufferToMonoPcm(
  buffer: Pick<AudioBuffer, "length" | "numberOfChannels" | "getChannelData">,
): Float32Array {
  const frames = Math.max(0, Math.floor(buffer.length));
  const channels = Math.max(0, Math.floor(buffer.numberOfChannels));
  const mono = new Float32Array(frames);
  if (frames === 0 || channels === 0) return mono;

  for (let ch = 0; ch < channels; ch += 1) {
    const data = buffer.getChannelData(ch);
    const limit = Math.min(frames, data.length);
    for (let i = 0; i < limit; i += 1) mono[i] += data[i] / channels;
  }
  return mono;
}

function offlineContextCtor(): typeof OfflineAudioContext | null {
  if (typeof window === "undefined") return null;
  return window.OfflineAudioContext
    ?? (window as Window & { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext
    ?? null;
}

/**
 * Decode an encoded audio file without activating the audible WebAudio runtime.
 *
 * This deliberately uses OfflineAudioContext rather than `ensureAudio()`. On a
 * Native runtime we must not construct the browser render graph merely to obtain
 * PCM for Native Groove. No audible AudioContext fallback is used here: callers
 * can surface unsupported decoding rather than silently creating a second
 * renderer.
 */
export async function decodeAudioFileForAsset(
  file: File,
  preferredSampleRate = 48000,
): Promise<AudioBuffer> {
  const OfflineCtx = offlineContextCtor();
  if (!OfflineCtx) {
    throw new Error("OfflineAudioContext unavailable for renderer-independent asset decode");
  }

  const sampleRate = Math.max(8000, Math.min(192000, Math.round(preferredSampleRate)));
  const context = new OfflineCtx(1, 1, sampleRate);
  const encoded = await file.arrayBuffer();
  const decoded = await context.decodeAudioData(encoded.slice(0));
  if (decoded.length <= 0 || decoded.numberOfChannels <= 0 || decoded.sampleRate <= 0) {
    throw new Error(`Decoded asset is invalid: ${file.name}`);
  }
  return decoded;
}

export async function decodeMonoAsset(
  file: File,
  preferredSampleRate = 48000,
): Promise<DecodedMonoAsset> {
  const buffer = await decodeAudioFileForAsset(file, preferredSampleRate);
  const monoPcm = audioBufferToMonoPcm(buffer);
  if (monoPcm.length === 0) throw new Error(`Decoded asset contains no PCM frames: ${file.name}`);
  return {
    buffer,
    monoPcm,
    sampleRate: buffer.sampleRate,
    lengthFrames: monoPcm.length,
  };
}
