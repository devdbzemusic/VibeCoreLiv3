/* eslint-disable */
// AudioWorklet: 'vibe-granular'
// Mixes up to MAX_GRAINS concurrent grains into a single stereo output.
// Runs on the audio render thread — zero main-thread cost during processing.
//
// Messages (main → worklet):
//   { type: 'init', window: Float32Array }         // Hann window table (size = WIN_SIZE)
//   { type: 'add',  id, buffer: Float32Array, startSample, length,
//                   pitchRatio, panL, panR, fadeInEnd, fadeOutStart }
//   { type: 'clear' }                              // drop all active grains
//
// Messages (worklet → main):
//   { type: 'ended', id }

declare const sampleRate: number;
declare const currentFrame: number;
declare class AudioWorkletProcessor {
  readonly port: MessagePort;
  constructor();
  process(inputs: Float32Array[][], outputs: Float32Array[][], params: Record<string, Float32Array>): boolean;
}
declare function registerProcessor(name: string, ctor: new () => AudioWorkletProcessor): void;

const MAX_GRAINS = 128;
const WIN_SIZE = 1024;

interface Grain {
  active: boolean;
  id: number;
  buf: Float32Array;
  pos: number;          // float read-position in source buffer (samples)
  startSample: number;
  length: number;       // total play length in *grain* samples
  consumed: number;     // grain samples already produced
  rate: number;         // playback ratio (source samples per output sample)
  panL: number;
  panR: number;
  fadeInEnd: number;    // grain-sample index where fade-in finishes
  fadeOutStart: number; // grain-sample index where fade-out starts
}

class VibeGranularProcessor extends AudioWorkletProcessor {
  private grains: Grain[] = [];
  private window: Float32Array | null = null;
  private endedQueue: number[] = [];

  constructor() {
    super();
    for (let i = 0; i < MAX_GRAINS; i++) {
      this.grains.push({
        active: false, id: 0, buf: new Float32Array(0),
        pos: 0, startSample: 0, length: 0, consumed: 0,
        rate: 1, panL: 0.707, panR: 0.707, fadeInEnd: 0, fadeOutStart: 0,
      });
    }
    this.port.onmessage = (ev: MessageEvent) => {
      const m = ev.data;
      if (!m) return;
      if (m.type === 'init') {
        this.window = m.window as Float32Array;
      } else if (m.type === 'add') {
        this.addGrain(m);
      } else if (m.type === 'clear') {
        for (let i = 0; i < MAX_GRAINS; i++) this.grains[i].active = false;
      }
    };
  }

  private addGrain(m: {
    id: number; buffer: Float32Array; startSample: number; length: number;
    pitchRatio: number; panL: number; panR: number;
    fadeInEnd: number; fadeOutStart: number;
  }) {
    for (let i = 0; i < MAX_GRAINS; i++) {
      const g = this.grains[i];
      if (!g.active) {
        g.active = true;
        g.id = m.id;
        g.buf = m.buffer;
        g.pos = m.startSample;
        g.startSample = m.startSample;
        g.length = m.length | 0;
        g.consumed = 0;
        g.rate = m.pitchRatio;
        g.panL = m.panL;
        g.panR = m.panR;
        g.fadeInEnd = Math.max(1, m.fadeInEnd | 0);
        g.fadeOutStart = Math.max(g.fadeInEnd, m.fadeOutStart | 0);
        return;
      }
    }
    // pool full → notify main thread so it can decay its bookkeeping
    this.endedQueue.push(m.id);
  }

  process(_inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    const out = outputs[0];
    const outL = out[0];
    const outR = out[1] || out[0];
    const n = outL.length;

    // clear (process buffers are not zeroed by spec)
    for (let i = 0; i < n; i++) { outL[i] = 0; if (outR !== outL) outR[i] = 0; }

    const win = this.window;
    const winLast = WIN_SIZE - 1;

    for (let gi = 0; gi < MAX_GRAINS; gi++) {
      const g = this.grains[gi];
      if (!g.active) continue;
      const buf = g.buf;
      const bufLen = buf.length;
      const len = g.length;
      const fIn = g.fadeInEnd;
      const fOut = g.fadeOutStart;
      const fOutSpan = Math.max(1, len - fOut);
      let pos = g.pos;
      let consumed = g.consumed;
      const rate = g.rate;
      const pL = g.panL;
      const pR = g.panR;

      for (let i = 0; i < n; i++) {
        if (consumed >= len) break;
        // linear interpolation read
        let s = 0;
        if (pos >= 0 && pos < bufLen - 1) {
          const i0 = pos | 0;
          const frac = pos - i0;
          s = buf[i0] * (1 - frac) + buf[i0 + 1] * frac;
        }

        // envelope: Hann window via precomputed table, mapped to attack/release
        let env: number;
        if (consumed < fIn) {
          // fade-in: 0..0.5 of window
          const idx = ((consumed / fIn) * 0.5 * winLast) | 0;
          env = win ? win[idx] : (consumed / fIn);
        } else if (consumed >= fOut) {
          // fade-out: 0.5..1.0 of window
          const t = (consumed - fOut) / fOutSpan;
          const idx = ((0.5 + t * 0.5) * winLast) | 0;
          env = win ? win[idx > winLast ? winLast : idx] : Math.max(0, 1 - t);
        } else {
          env = 1;
        }

        const v = s * env;
        outL[i] += v * pL;
        outR[i] += v * pR;

        pos += rate;
        consumed++;
      }

      g.pos = pos;
      g.consumed = consumed;

      if (consumed >= len) {
        g.active = false;
        this.endedQueue.push(g.id);
      }
    }

    if (this.endedQueue.length) {
      // flush ended ids in one batched message
      const ids = this.endedQueue.slice();
      this.endedQueue.length = 0;
      this.port.postMessage({ type: 'ended', ids });
    }
    return true;
  }
}

registerProcessor('vibe-granular', VibeGranularProcessor);
