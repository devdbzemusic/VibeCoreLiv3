// VibeCoreLiv3 — Audio-synchronous scheduler probe (AudioWorklet).
//
// PURPOSE
//   Measure scheduler timing against the REAL audio clock. The probe runs
//   on the audio render thread (AudioWorklet) so `currentTime` reads are
//   sample-accurate and unaffected by main-thread / React scheduling. This
//   replaces the previous ScriptProcessor probe, whose main-thread
//   `currentTime` reads produced spurious >1000 ms "jitter".
//
//   The probe is purely a measurement instrument. Its AudioWorklet output is
//   routed through a zero-gain node to ctx.destination only so the graph
//   pulls process() every quantum — it emits silence and never appears in
//   the audible signal path.
//
// METRICS (all audio-synchronous)
//   jitterMs    : stddev of (observedAt − scheduledFor) over recent events
//   driftMs     : linear-regression slope of (observedAt − scheduledFor)
//                 vs scheduledFor, expressed as ms drift per minute
//   stability01 : fraction of events where |observedAt − scheduledFor| < 1 ms
//   lateTicks   : count of scheduled events whose scheduledFor had already
//                 passed when the audio callback first observed them
//   xruns       : count of events queued with scheduledFor < scheduledAt
//                 (scheduler missed its lookahead window at queue time)
//   eventCount  : number of events currently in the ring buffer
//
// The ring buffer keeps the latest 10 000 events for export.

export interface SchedEvent {
  scheduledAt: number;   // audio context time when tick was scheduled (s)
  scheduledFor: number;  // audio context time the tick should fire at (s)
  observedAt: number;    // audio-thread time when callback first saw it (s)
  deltaMs: number;       // (observedAt − scheduledFor) * 1000
}

export interface ProbeStats {
  jitterMs: number;
  driftMsPerMin: number;
  stability01: number;
  lateTicks: number;
  xruns: number;
  eventCount: number;
  installed: boolean;
  mode: "none" | "worklet" | "sp";
}

export interface EventSummary {
  totalEvents: number;
  avgDeltaMs: number;
  medianDeltaMs: number;
  p95DeltaMs: number;
  maxDeltaMs: number;
  stdDevMs: number;
  lateTicks: number;
  xruns: number;
  classification: "GOOD" | "WARNING" | "CRITICAL" | "NO_DATA";
}

const RING_SIZE = 10_000;
const ring: SchedEvent[] = [];
let ringHead = 0;
let xrunsTotal = 0;
let lateTicksTotal = 0;
let seqCounter = 0;

interface Pending {
  scheduledAt: number;
  scheduledFor: number;
}
const pending: Pending[] = []; // only used by the ScriptProcessor fallback

let mode: "none" | "worklet" | "sp" = "none";
let workletNode: AudioWorkletNode | null = null;
let muteGain: GainNode | null = null;
let processor: ScriptProcessorNode | null = null;
let installedCtx: AudioContext | null = null;

function pushEvent(ev: SchedEvent): void {
  if (ring.length < RING_SIZE) ring.push(ev);
  else { ring[ringHead] = ev; ringHead = (ringHead + 1) % RING_SIZE; }
}

function commitObserved(scheduledAt: number, scheduledFor: number, observedAt: number): void {
  const deltaMs = (observedAt - scheduledFor) * 1000;
  if (scheduledFor < scheduledAt) lateTicksTotal++;
  pushEvent({ scheduledAt, scheduledFor, observedAt, deltaMs });
}

/** Called by the scheduler each time it schedules a tick. */
export function recordScheduledTick(scheduledAt: number, scheduledFor: number): void {
  // XRUN: scheduling target is already in the past at queue time.
  if (scheduledFor < scheduledAt) xrunsTotal++;
  if (mode === "worklet" && workletNode) {
    try {
      workletNode.port.postMessage({
        type: "tick",
        scheduledAt,
        scheduledFor,
        seq: seqCounter++,
      });
    } catch { /* node tearing down — drop */ }
    return;
  }
  // ScriptProcessor fallback path (or probe not yet installed).
  pending.push({ scheduledAt, scheduledFor });
  if (pending.length > 2000) pending.splice(0, pending.length - 2000);
}

/** Install the probe. Prefers an AudioWorklet (true audio-thread timing);
 *  falls back to a ScriptProcessor (main-thread, less accurate) if the
 *  worklet module cannot be loaded. Safe to call repeatedly; no-op if
 *  already installed on the same context. */
export async function installProbe(ctx: AudioContext): Promise<void> {
  if (installedCtx === ctx && mode !== "none") return;
  uninstallProbe();
  installedCtx = ctx;

  // ── Preferred: AudioWorklet (audio render thread) ────────────────────
  try {
    await ctx.audioWorklet.addModule(
      new URL("../../workers/timing-probe.worklet.ts", import.meta.url)
    );
    const node = new AudioWorkletNode(ctx, "vibe-timing-probe", {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [1],
    });
    const mute = ctx.createGain();
    mute.gain.value = 0;
    // Pull path: node → mute(0) → destination. Guarantees process() runs
    // every quantum while emitting silence.
    node.connect(mute).connect(ctx.destination);
    node.port.onmessage = (ev: MessageEvent) => {
      const m = ev.data as
        | { type: "observed"; events: Array<{ scheduledAt: number; scheduledFor: number; observedAt: number; seq: number }> }
        | { type: string };
      if (m && m.type === "observed" && Array.isArray(m.events)) {
        for (const e of m.events) {
          commitObserved(e.scheduledAt, e.scheduledFor, e.observedAt);
        }
      }
    };
    workletNode = node;
    muteGain = mute;
    mode = "worklet";
    return;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[timing-probe] AudioWorklet unavailable, falling back to ScriptProcessor", err);
  }

  // ── Fallback: ScriptProcessor (main thread) ──────────────────────────
  try {
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    processor = ctx.createScriptProcessor(256, 1, 1);
    processor.onaudioprocess = () => {
      if (!installedCtx) return;
      const now = installedCtx.currentTime;
      let i = 0;
      while (i < pending.length && pending[i].scheduledFor <= now) {
        const p = pending[i];
        commitObserved(p.scheduledAt, p.scheduledFor, now);
        i++;
      }
      if (i > 0) pending.splice(0, i);
    };
    processor.connect(ctx.destination);
    mode = "sp";
  } catch {
    mode = "none";
  }
}

export function uninstallProbe(): void {
  try { workletNode?.disconnect(); } catch { /* ignore */ }
  try { muteGain?.disconnect(); } catch { /* ignore */ }
  try { processor?.disconnect(); } catch { /* ignore */ }
  workletNode = null; muteGain = null; processor = null;
  installedCtx = null; mode = "none";
}

export function resetProbe(): void {
  ring.length = 0; ringHead = 0; pending.length = 0;
  lateTicksTotal = 0; xrunsTotal = 0; seqCounter = 0;
  if (workletNode) {
    try { workletNode.port.postMessage({ type: "reset" }); } catch { /* ignore */ }
  }
}

function snapshot(): SchedEvent[] {
  if (ring.length < RING_SIZE) return ring.slice();
  return ring.slice(ringHead).concat(ring.slice(0, ringHead));
}

export function getProbeStats(): ProbeStats {
  const ev = snapshot();
  const n = ev.length;
  if (n < 4) {
    return { jitterMs: 0, driftMsPerMin: 0, stability01: 0, lateTicks: lateTicksTotal, xruns: xrunsTotal, eventCount: n, installed: mode !== "none", mode };
  }
  let mean = 0; for (const e of ev) mean += e.deltaMs; mean /= n;
  let varSum = 0; for (const e of ev) { const d = e.deltaMs - mean; varSum += d * d; }
  const jitterMs = Math.sqrt(varSum / n);
  let onTime = 0; for (const e of ev) if (Math.abs(e.deltaMs) < 1) onTime++;
  const stability01 = onTime / n;
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  const t0 = ev[0].scheduledFor;
  for (const e of ev) {
    const x = e.scheduledFor - t0; const y = e.deltaMs;
    sx += x; sy += y; sxx += x * x; sxy += x * y;
  }
  const denom = n * sxx - sx * sx;
  const slope = denom !== 0 ? (n * sxy - sx * sy) / denom : 0;
  const driftMsPerMin = slope * 60;
  return { jitterMs, driftMsPerMin, stability01, lateTicks: lateTicksTotal, xruns: xrunsTotal, eventCount: n, installed: mode !== "none", mode };
}

/** Export the most recent N events (ring buffer of up to 10 000). */
export function exportRawEvents(limit?: number): SchedEvent[] {
  const all = snapshot();
  if (!limit || limit >= all.length) return all;
  return all.slice(-limit);
}

/** Compact event-summary statistics with GOOD/WARNING/CRITICAL classification. */
export function getEventSummary(limit?: number): EventSummary {
  const ev = exportRawEvents(limit);
  const n = ev.length;
  if (n === 0) return { totalEvents: 0, avgDeltaMs: 0, medianDeltaMs: 0, p95DeltaMs: 0, maxDeltaMs: 0, stdDevMs: 0, lateTicks: 0, xruns: xrunsTotal, classification: "NO_DATA" };
  const deltas = ev.map((e) => e.deltaMs).slice().sort((a, b) => a - b);
  const avg = deltas.reduce((s, v) => s + v, 0) / n;
  const median = deltas[Math.floor(n / 2)];
  const p95 = deltas[Math.min(n - 1, Math.floor(n * 0.95))];
  const max = deltas[n - 1];
  let varSum = 0; for (const d of deltas) varSum += (d - avg) * (d - avg);
  const stdDev = Math.sqrt(varSum / n);
  const lateTicks = ev.filter((e) => e.scheduledFor < e.scheduledAt).length;
  const classification: EventSummary["classification"] =
    p95 < 2 ? "GOOD" : p95 < 5 ? "WARNING" : "CRITICAL";
  const r = (x: number) => Math.round(x * 100) / 100;
  return { totalEvents: n, avgDeltaMs: r(avg), medianDeltaMs: r(median), p95DeltaMs: r(p95), maxDeltaMs: r(max), stdDevMs: r(stdDev), lateTicks, xruns: xrunsTotal, classification };
}