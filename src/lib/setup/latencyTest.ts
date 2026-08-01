// VibeCoreLiv3 — Audio latency probing (Sprint 6A + Diagnostics Fix).
//
// =============================================================================
// METRIC DEFINITIONS
// =============================================================================
//
//   inputMs     : navigator.mediaDevices.getUserMedia().getSettings().latency
//                 multiplied by 1000, when reported by the UA. Falls back to
//                 baseLatency when not available (e.g. permission denied).
//                 Units: milliseconds.
//
//   outputMs    : AudioContext.outputLatency * 1000 when > 0, else
//                 AudioContext.baseLatency * 1000. Reported by the UA; NOT
//                 measured manually. Represents the time between a node
//                 scheduling a sample and that sample reaching the speakers
//                 (or the OS audio sink in cases where outputLatency is 0).
//                 Units: milliseconds.
//
//   roundtripMs : inputMs + outputMs. Only meaningful if both come from real
//                 hardware probes; otherwise it is an estimate. A true
//                 acoustic loopback would require playing a click and
//                 detecting it on the input mic, which is out of scope here.
//                 Units: milliseconds.
//
// All values come from the AudioContext / MediaStream APIs directly — there
// is no setInterval- or performance.now()-based "manual" measurement, which
// avoids the cross-Android variance seen previously.
// =============================================================================

import { ensureAudio } from "@/lib/audio/engine";
import type { LatencyReport } from "./setupStore";

export async function runLatencyTest(): Promise<LatencyReport> {
  const ctx = await ensureAudio();
  const base = (ctx.baseLatency ?? 0) * 1000;
  const out = ((ctx as AudioContext & { outputLatency?: number }).outputLatency ?? 0) * 1000;
  let inputMs = base;
  try {
    if (navigator.mediaDevices?.getUserMedia) {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false } });
      const settings = stream.getAudioTracks()[0]?.getSettings() as MediaTrackSettings & { latency?: number };
      if (typeof settings?.latency === "number") inputMs = settings.latency * 1000;
      stream.getTracks().forEach((t) => t.stop());
    }
  } catch { /* keep fallback */ }

  const outputMs = out > 0 ? out : base;
  const roundtripMs = inputMs + outputMs;
  // eslint-disable-next-line no-console
  console.log("[LatencyTest] formulas: inputMs=getSettings().latency*1000, outputMs=outputLatency*1000||baseLatency*1000, roundtripMs=inputMs+outputMs");
  return { inputMs, outputMs, roundtripMs, at: Date.now() };
}
