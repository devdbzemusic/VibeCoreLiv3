/* eslint-disable */
// AudioWorklet: 'vibe-timing-probe'
//
// Runs on the AUDIO RENDER THREAD. Each quantum it reads `currentTime`
// (the sample-accurate audio clock) and reports, for every scheduled tick
// whose target time has elapsed, the audio-thread time at which it was
// observed.
//
// This replaces the main-thread ScriptProcessor probe, whose `currentTime`
// reads were delayed by main-thread / React scheduling and produced
// spurious >1000 ms "jitter" that had nothing to do with audio timing.
// The worklet's `currentTime` IS the real audio clock — its observations
// correlate with audible glitches.
//
// Messages (main → worklet):
//   { type: 'tick', scheduledAt, scheduledFor, seq }
//   { type: 'reset' }
// Messages (worklet → main):
//   { type: 'observed', events: [{ scheduledAt, scheduledFor, observedAt, seq }] }

declare const currentTime: number;
declare class AudioWorkletProcessor {
  readonly port: MessagePort;
  constructor();
  process(inputs: Float32Array[][], outputs: Float32Array[][], params: Record<string, Float32Array>): boolean;
}
declare function registerProcessor(name: string, ctor: new () => AudioWorkletProcessor): void;

interface PendingTick { scheduledAt: number; scheduledFor: number; seq: number; }

class TimingProbeProcessor extends AudioWorkletProcessor {
  private pending: PendingTick[] = [];

  constructor() {
    super();
    this.port.onmessage = (e: MessageEvent) => {
      const m = e.data as { type: string; scheduledAt?: number; scheduledFor?: number; seq?: number };
      if (m.type === "tick") {
        const sAt = typeof m.scheduledAt === "number" ? m.scheduledAt : 0;
        const sFor = typeof m.scheduledFor === "number" ? m.scheduledFor : 0;
        const seq = typeof m.seq === "number" ? m.seq : 0;
        this.pending.push({ scheduledAt: sAt, scheduledFor: sFor, seq });
        if (this.pending.length > 4000) this.pending.splice(0, this.pending.length - 4000);
      } else if (m.type === "reset") {
        this.pending.length = 0;
      }
    };
  }

  process(): boolean {
    const now = currentTime; // audio-thread clock, sample-accurate
    if (this.pending.length === 0) return true;
    const ready: Array<{ scheduledAt: number; scheduledFor: number; observedAt: number; seq: number }> = [];
    let i = 0;
    while (i < this.pending.length && this.pending[i].scheduledFor <= now) {
      const p = this.pending[i];
      ready.push({ scheduledAt: p.scheduledAt, scheduledFor: p.scheduledFor, observedAt: now, seq: p.seq });
      i++;
    }
    if (i > 0) this.pending.splice(0, i);
    if (ready.length > 0) this.port.postMessage({ type: "observed", events: ready });
    return true;
  }
}

registerProcessor("vibe-timing-probe", TimingProbeProcessor);