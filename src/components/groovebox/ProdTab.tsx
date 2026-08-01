// Sample Producer Maschine — Quantum SFX-inspired UI.
// Procedural sample generator with FM/morph/tube/binaural styling.
// Produces a one-shot rendered offline → playable + downloadable WAV.
// Rendering runs in a dedicated Web Worker (prodRender.worker.ts) so the
// UI thread stays at 60 fps on low-end Android while a sample is synthesized.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { renderProdSample, type ProdParams as WorkerProdParams } from "@/lib/audio/prodRender";

type Category = "KICK" | "SNARE" | "HAT" | "BASS" | "LEAD" | "FX" | "PERC" | "PAD";

interface ProdParams {
  baseFreq: number;   // 30..2000
  duration: number;   // 0.05..3
  volume: number;     // 0..1
  lpf: number;        // 200..20000
  res: number;        // 0.1..20
  hpf: number;        // 20..2000
  attack: number;     // 0..1
  decay: number;      // 0..1.5
  sustain: number;    // 0..1
  release: number;    // 0..2
  pitchEnv: number;   // -2400..2400 cents (slide)
  fmAmount: number;   // 0..1500
  fmRatio: number;    // 0.25..8
  morph: number;      // 0..1 (sine→saw→sq blend)
  noise: number;      // 0..1
  tubeDrive: number;  // 0..1
  bitcrush: number;   // 0..1
  reverb: number;     // 0..1
  width: number;      // 0..1 stereo widen
}

const DEFAULTS: ProdParams = {
  baseFreq: 110, duration: 0.6, volume: 0.8,
  lpf: 9000, res: 1.0, hpf: 30,
  attack: 0.005, decay: 0.22, sustain: 0.35, release: 0.28,
  pitchEnv: 0, fmAmount: 180, fmRatio: 2.0, morph: 0.4,
  noise: 0.05, tubeDrive: 0.35, bitcrush: 0, reverb: 0.15, width: 0.4,
};

interface KnobDef {
  k: keyof ProdParams; label: string; min: number; max: number; step: number;
  format?: (v: number) => string;
  curve?: "lin" | "log";
  tone?: "cyan" | "magenta" | "amber";
}

const KNOBS: KnobDef[] = [
  { k: "baseFreq", label: "BASE", min: 30, max: 2000, step: 1, curve: "log", format: (v) => `${v.toFixed(0)}Hz`, tone: "cyan" },
  { k: "duration", label: "TIME", min: 0.05, max: 3, step: 0.01, format: (v) => `${v.toFixed(2)}s`, tone: "cyan" },
  { k: "volume", label: "VOL", min: 0, max: 1, step: 0.01, format: (v) => v.toFixed(2), tone: "cyan" },
  { k: "lpf", label: "LPF", min: 200, max: 20000, step: 1, curve: "log", format: (v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v.toFixed(0)}`, tone: "cyan" },
  { k: "res", label: "RES", min: 0.1, max: 20, step: 0.1, format: (v) => v.toFixed(1), tone: "cyan" },
  { k: "hpf", label: "HPF", min: 20, max: 2000, step: 1, curve: "log", format: (v) => `${v.toFixed(0)}`, tone: "cyan" },
  { k: "attack", label: "ATK", min: 0, max: 1, step: 0.001, format: (v) => v.toFixed(3), tone: "cyan" },
  { k: "decay", label: "DEC", min: 0, max: 1.5, step: 0.01, format: (v) => v.toFixed(2), tone: "cyan" },
  { k: "sustain", label: "SUS", min: 0, max: 1, step: 0.01, format: (v) => v.toFixed(2), tone: "cyan" },
  { k: "release", label: "REL", min: 0, max: 2, step: 0.01, format: (v) => v.toFixed(2), tone: "cyan" },
  { k: "pitchEnv", label: "SLIDE", min: -2400, max: 2400, step: 1, format: (v) => `${v >= 0 ? "+" : ""}${v.toFixed(0)}`, tone: "magenta" },
  { k: "fmAmount", label: "FM AMT", min: 0, max: 1500, step: 1, format: (v) => v.toFixed(0), tone: "magenta" },
  { k: "fmRatio", label: "FM RAT", min: 0.25, max: 8, step: 0.01, format: (v) => v.toFixed(2), tone: "magenta" },
  { k: "morph", label: "MORPH", min: 0, max: 1, step: 0.01, format: (v) => v.toFixed(2), tone: "magenta" },
  { k: "noise", label: "NOISE", min: 0, max: 1, step: 0.01, format: (v) => v.toFixed(2), tone: "magenta" },
  { k: "tubeDrive", label: "TUBE", min: 0, max: 1, step: 0.01, format: (v) => v.toFixed(2), tone: "amber" },
  { k: "bitcrush", label: "CRUSH", min: 0, max: 1, step: 0.01, format: (v) => v.toFixed(2), tone: "amber" },
  { k: "reverb", label: "VERB", min: 0, max: 1, step: 0.01, format: (v) => v.toFixed(2), tone: "amber" },
  { k: "width", label: "WIDTH", min: 0, max: 1, step: 0.01, format: (v) => v.toFixed(2), tone: "amber" },
];

const PRESETS: Record<string, { cat: Category; p: Partial<ProdParams> }> = {
  RESET: { cat: "KICK", p: DEFAULTS },
  KICK: { cat: "KICK", p: { baseFreq: 55, duration: 0.6, attack: 0.001, decay: 0.18, sustain: 0, release: 0.3, pitchEnv: -1800, fmAmount: 0, morph: 0.2, noise: 0.02, tubeDrive: 0.5, lpf: 4500, res: 1.4 } },
  "808": { cat: "BASS", p: { baseFreq: 45, duration: 1.4, attack: 0.001, decay: 0.6, sustain: 0.4, release: 0.7, pitchEnv: -600, fmAmount: 30, morph: 0.05, tubeDrive: 0.6, lpf: 2800 } },
  SNARE: { cat: "SNARE", p: { baseFreq: 220, duration: 0.32, attack: 0.001, decay: 0.12, sustain: 0, release: 0.18, pitchEnv: -400, fmAmount: 120, morph: 0.55, noise: 0.7, tubeDrive: 0.4, lpf: 9000, hpf: 280, res: 2.5 } },
  CLAP: { cat: "PERC", p: { baseFreq: 600, duration: 0.28, attack: 0.001, decay: 0.09, sustain: 0, release: 0.2, fmAmount: 60, noise: 0.9, tubeDrive: 0.35, hpf: 800, lpf: 7500 } },
  HAT: { cat: "HAT", p: { baseFreq: 9000, duration: 0.12, attack: 0.0005, decay: 0.05, sustain: 0, release: 0.06, fmAmount: 0, morph: 0.9, noise: 1.0, hpf: 4000, lpf: 16000, res: 0.6, tubeDrive: 0.2 } },
  OPEN: { cat: "HAT", p: { baseFreq: 8500, duration: 0.5, attack: 0.0005, decay: 0.3, sustain: 0.05, release: 0.3, noise: 1.0, hpf: 3500, lpf: 14000, tubeDrive: 0.2 } },
  BASS: { cat: "BASS", p: { baseFreq: 65, duration: 0.7, attack: 0.005, decay: 0.3, sustain: 0.6, release: 0.25, fmAmount: 240, fmRatio: 1.5, morph: 0.6, tubeDrive: 0.55, lpf: 1800, res: 3 } },
  LEAD: { cat: "LEAD", p: { baseFreq: 330, duration: 0.9, attack: 0.01, decay: 0.2, sustain: 0.7, release: 0.5, fmAmount: 420, fmRatio: 3.0, morph: 0.7, tubeDrive: 0.3, lpf: 7500, res: 4, width: 0.6 } },
  PAD: { cat: "PAD", p: { baseFreq: 220, duration: 2.5, attack: 0.4, decay: 0.8, sustain: 0.7, release: 1.2, fmAmount: 80, morph: 0.5, lpf: 5500, reverb: 0.6, width: 0.9 } },
  LASER: { cat: "FX", p: { baseFreq: 1400, duration: 0.4, attack: 0.002, decay: 0.1, sustain: 0.2, release: 0.25, pitchEnv: -1800, fmAmount: 700, fmRatio: 3.5, morph: 0.75, tubeDrive: 0.5, lpf: 9000, res: 4 } },
  ZAP: { cat: "FX", p: { baseFreq: 800, duration: 0.25, attack: 0.001, decay: 0.08, sustain: 0, release: 0.15, pitchEnv: 1500, fmAmount: 500, fmRatio: 4.0, morph: 0.85, tubeDrive: 0.6, bitcrush: 0.3 } },
  RISER: { cat: "FX", p: { baseFreq: 80, duration: 2.0, attack: 0.05, decay: 1.5, sustain: 0.9, release: 0.4, pitchEnv: 2200, fmAmount: 300, fmRatio: 2.5, morph: 0.6, noise: 0.3, reverb: 0.5, width: 0.8 } },
  GLITCH: { cat: "FX", p: { baseFreq: 440, duration: 0.4, attack: 0.001, decay: 0.1, sustain: 0.3, release: 0.2, fmAmount: 900, fmRatio: 5.7, morph: 0.85, bitcrush: 0.7, tubeDrive: 0.5 } },
};

// ─── Procedural rendering (delegated to worker module) ─────────────────────
// The heavy synthesis loop lives in `src/lib/audio/prodRender.ts` so it can be
// imported by both the worker and the (sync) fallback path below.

type _ParamsCheck = WorkerProdParams extends ProdParams ? true : false;
const _typeCheck: _ParamsCheck = true; void _typeCheck;

function resultToAudioBuffer(res: { sampleRate: number; length: number; channels: Float32Array[] }): AudioBuffer {
  const Ctor = (window.OfflineAudioContext || (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext);
  const tmp = new Ctor(res.channels.length, res.length, res.sampleRate);
  const buf = tmp.createBuffer(res.channels.length, res.length, res.sampleRate);
  for (let c = 0; c < res.channels.length; c++) buf.getChannelData(c).set(res.channels[c]);
  return buf;
}

/** Synchronous fallback used when Web Workers are unavailable (very old WebViews). */
function renderSampleSync(p: ProdParams, opts: { stereo?: boolean; sampleRate?: number } = {}): AudioBuffer {
  return resultToAudioBuffer(renderProdSample(p, opts));
}

// ─── Worker-backed renderer ────────────────────────────────────────────────
// Lazily instantiates a single dedicated worker; falls back to the sync
// renderer if the runtime can't construct module workers.

let workerInstance: Worker | null = null;
let workerReqId = 0;
const pendingReqs = new Map<number, (res: AudioBuffer) => void>();

function getRenderWorker(): Worker | null {
  if (workerInstance) return workerInstance;
  try {
    workerInstance = new Worker(new URL("../../workers/prodRender.worker.ts", import.meta.url), { type: "module" });
    workerInstance.addEventListener("message", (ev: MessageEvent<{ id: number; sampleRate: number; length: number; channels: Float32Array[] }>) => {
      const cb = pendingReqs.get(ev.data.id);
      if (cb) {
        pendingReqs.delete(ev.data.id);
        cb(resultToAudioBuffer(ev.data));
      }
    });
    workerInstance.addEventListener("error", () => { workerInstance = null; });
    return workerInstance;
  } catch {
    return null;
  }
}

function renderSample(p: ProdParams, opts: { stereo?: boolean; sampleRate?: number } = {}): Promise<AudioBuffer> {
  const w = getRenderWorker();
  if (!w) return Promise.resolve(renderSampleSync(p, opts));
  return new Promise((resolve) => {
    const id = ++workerReqId;
    pendingReqs.set(id, resolve);
    w.postMessage({ id, params: p, opts });
  });
}

// ─── WAV encode ────────────────────────────────────────────────────────────

function bufferToWavBlob(buf: AudioBuffer): Blob {
  const numCh = buf.numberOfChannels;
  const sr = buf.sampleRate;
  const len = buf.length;
  const bytesPerSample = 2;
  const blockAlign = numCh * bytesPerSample;
  const byteRate = sr * blockAlign;
  const dataSize = len * blockAlign;
  const ab = new ArrayBuffer(44 + dataSize);
  const dv = new DataView(ab);
  const wstr = (off: number, s: string) => { for (let i = 0; i < s.length; i++) dv.setUint8(off + i, s.charCodeAt(i)); };
  wstr(0, "RIFF"); dv.setUint32(4, 36 + dataSize, true); wstr(8, "WAVE");
  wstr(12, "fmt "); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true);
  dv.setUint16(22, numCh, true); dv.setUint32(24, sr, true);
  dv.setUint32(28, byteRate, true); dv.setUint16(32, blockAlign, true); dv.setUint16(34, 16, true);
  wstr(36, "data"); dv.setUint32(40, dataSize, true);
  const chans: Float32Array[] = [];
  for (let c = 0; c < numCh; c++) chans.push(buf.getChannelData(c));
  let off = 44;
  for (let n = 0; n < len; n++) {
    for (let c = 0; c < numCh; c++) {
      const s = Math.max(-1, Math.min(1, chans[c][n]));
      dv.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      off += 2;
    }
  }
  return new Blob([ab], { type: "audio/wav" });
}

// ─── Knob component ────────────────────────────────────────────────────────

function Knob({ def, value, onChange }: { def: KnobDef; value: number; onChange: (v: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const startRef = useRef<{ y: number; v: number } | null>(null);

  const norm = useMemo(() => {
    if (def.curve === "log") {
      const ln = Math.log(Math.max(def.min, 1e-6));
      const lx = Math.log(Math.max(def.max, 1e-6));
      return (Math.log(Math.max(value, 1e-6)) - ln) / (lx - ln);
    }
    return (value - def.min) / (def.max - def.min);
  }, [value, def]);

  const angle = -135 + Math.max(0, Math.min(1, norm)) * 270;

  const applyDelta = useCallback((dy: number) => {
    if (!startRef.current) return;
    const frac = -dy / 180;
    let nextNorm: number;
    if (def.curve === "log") {
      const ln = Math.log(Math.max(def.min, 1e-6));
      const lx = Math.log(Math.max(def.max, 1e-6));
      const startNorm = (Math.log(Math.max(startRef.current.v, 1e-6)) - ln) / (lx - ln);
      nextNorm = Math.max(0, Math.min(1, startNorm + frac));
      const next = Math.exp(ln + nextNorm * (lx - ln));
      onChange(roundStep(next, def.step));
    } else {
      const startNorm = (startRef.current.v - def.min) / (def.max - def.min);
      nextNorm = Math.max(0, Math.min(1, startNorm + frac));
      const next = def.min + nextNorm * (def.max - def.min);
      onChange(roundStep(next, def.step));
    }
  }, [def, onChange]);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    startRef.current = { y: e.clientY, v: value };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!startRef.current) return;
    applyDelta(e.clientY - startRef.current.y);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    startRef.current = null;
  };
  const onDouble = () => onChange(DEFAULTS[def.k]);

  const toneRing = def.tone === "magenta"
    ? "shadow-[0_0_14px_hsl(290_85%_60%/0.35),inset_0_2px_6px_rgba(0,0,0,0.9),inset_0_-2px_4px_rgba(255,255,255,0.06)]"
    : def.tone === "amber"
    ? "shadow-[0_0_14px_hsl(38_95%_55%/0.35),inset_0_2px_6px_rgba(0,0,0,0.9),inset_0_-2px_4px_rgba(255,255,255,0.06)]"
    : "shadow-[0_0_14px_hsl(190_95%_55%/0.35),inset_0_2px_6px_rgba(0,0,0,0.9),inset_0_-2px_4px_rgba(255,255,255,0.06)]";

  const indicator = def.tone === "magenta" ? "bg-fuchsia-400 shadow-[0_0_8px_hsl(290_90%_65%),0_0_14px_hsl(290_90%_65%/0.6)]"
    : def.tone === "amber" ? "bg-amber-400 shadow-[0_0_8px_hsl(38_100%_60%),0_0_14px_hsl(38_100%_60%/0.6)]"
    : "bg-cyan-300 shadow-[0_0_8px_hsl(180_100%_55%),0_0_14px_hsl(180_100%_55%/0.6)]";

  const valueColor = def.tone === "magenta" ? "text-fuchsia-300" : def.tone === "amber" ? "text-amber-300" : "text-cyan-300";

  return (
    <div className="flex flex-col items-center gap-1 select-none">
      <div
        ref={ref}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={onDouble}
        className={cn(
          "relative w-[58px] h-[58px] rounded-full cursor-ns-resize touch-none",
          "bg-[radial-gradient(circle_at_30%_25%,#4b5160,#2a2f3a_60%,#14181f)]",
          "ring-2 ring-black/60",
          toneRing,
        )}
        title={`${def.label}: ${def.format ? def.format(value) : value.toFixed(2)} (double-click to reset)`}
      >
        <div
          className="absolute inset-[6px] rounded-full border border-black/80 bg-[conic-gradient(from_0deg,#1a1f28,#2c3340,#1a1f28)] shadow-[inset_0_2px_4px_#000]"
          style={{ transform: `rotate(${angle}deg)` }}
        >
          <div className={cn("absolute top-[3px] left-1/2 w-[3px] h-[14px] -translate-x-1/2 rounded-sm", indicator)} />
        </div>
      </div>
      <div className="font-mono text-[9px] tracking-[0.15em] text-muted-foreground">{def.label}</div>
      <div className={cn("font-mono text-[10px] tabular-nums", valueColor)}>{def.format ? def.format(value) : value.toFixed(2)}</div>
    </div>
  );
}

function roundStep(v: number, step: number): number {
  return Math.round(v / step) * step;
}

// ─── Tube SVG ──────────────────────────────────────────────────────────────

function Tube({ idx, activity }: { idx: number; activity: number }) {
  const glow = 0.35 + activity * 0.65;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <svg width="74" height="104" viewBox="0 0 74 104" className="overflow-visible">
        <defs>
          <linearGradient id={`tg${idx}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#3a2412" />
            <stop offset="40%" stopColor="#1f1208" />
            <stop offset="100%" stopColor="#080400" />
          </linearGradient>
          <radialGradient id={`rg${idx}`} cx="50%" cy="40%">
            <stop offset="0%" stopColor="#ffcc66" stopOpacity={glow} />
            <stop offset="55%" stopColor="#ff8800" stopOpacity={glow * 0.55} />
            <stop offset="100%" stopColor="#5a2200" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect x="6" y="2" width="62" height="86" rx="30" fill={`url(#tg${idx})`} stroke="#6b3a1a" strokeWidth="1.5" />
        <ellipse cx="37" cy="44" rx="22" ry="32" fill={`url(#rg${idx})`} />
        {/* heater filaments — concentric arcs */}
        {[0, 1, 2].map((i) => (
          <path
            key={i}
            d={`M 18 ${36 + i * 10} Q 37 ${28 + i * 10} 56 ${36 + i * 10}`}
            stroke="#ffaa33"
            strokeOpacity={0.4 + activity * 0.5}
            strokeWidth="1.5"
            fill="none"
            style={{ filter: `drop-shadow(0 0 ${2 + activity * 4}px #ff8800)` }}
          />
        ))}
        <circle cx="37" cy="56" r="2.2" fill="#ffd084" style={{ filter: `drop-shadow(0 0 ${3 + activity * 5}px #ffae3a)` }} />
        {/* base */}
        <rect x="14" y="88" width="46" height="12" rx="3" fill="#1a1410" stroke="#5a3a20" />
        <circle cx="22" cy="94" r="1.6" fill="#f59e0b" opacity={0.7} />
        <circle cx="52" cy="94" r="1.6" fill="#f59e0b" opacity={0.7} />
      </svg>
      <div className="font-display text-[10px] tracking-[0.3em] text-amber-300/80">V{idx}</div>
    </div>
  );
}

// ─── Visualisers ───────────────────────────────────────────────────────────

function Spectrum({ buffer }: { buffer: AudioBuffer | null }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext("2d"); if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    if (!buffer) {
      ctx.fillStyle = "rgba(34, 211, 238, 0.4)";
      ctx.font = "10px monospace";
      ctx.fillText("— NO SAMPLE —", c.width / 2 - 40, c.height / 2);
      return;
    }
    const data = buffer.getChannelData(0);
    const W = c.width, H = c.height;
    // Waveform RMS bars
    const bars = 96;
    const block = Math.floor(data.length / bars);
    ctx.fillStyle = "hsl(290 90% 60%)";
    for (let i = 0; i < bars; i++) {
      let sum = 0;
      for (let j = 0; j < block; j++) { const s = data[i * block + j] || 0; sum += s * s; }
      const rms = Math.sqrt(sum / Math.max(1, block));
      const h = Math.min(H, rms * H * 3.5);
      ctx.fillRect(i * (W / bars) + 1, (H - h) / 2, W / bars - 2, h);
    }
    // Centerline
    ctx.strokeStyle = "hsl(190 100% 60% / 0.25)";
    ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke();
  }, [buffer]);
  return <canvas ref={ref} width={360} height={110} className="w-full h-[110px] rounded-lg bg-[radial-gradient(circle_at_center,#061018,#000)]" />;
}

function HeatMap({ params }: { params: ProdParams }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext("2d"); if (!ctx) return;
    const W = c.width, H = c.height;
    ctx.fillStyle = "#040201"; ctx.fillRect(0, 0, W, H);
    const cells = 24;
    const cw = W / cells;
    for (let i = 0; i < cells; i++) {
      const t = i / cells;
      const heat = Math.max(0, Math.min(1,
        0.2 + Math.sin(t * Math.PI * (1 + params.fmRatio)) * 0.3 * params.morph
        + params.tubeDrive * (1 - t) * 0.6
        + params.fmAmount / 1500 * 0.3));
      const h = heat * (H - 16) + 6;
      const grad = ctx.createLinearGradient(0, H, 0, H - h);
      grad.addColorStop(0, `hsla(20, 100%, ${30 + heat * 30}%, ${0.5 + heat * 0.5})`);
      grad.addColorStop(1, `hsla(40, 100%, ${55 + heat * 20}%, ${0.6 + heat * 0.4})`);
      ctx.fillStyle = grad;
      ctx.fillRect(i * cw + 2, H - h - 2, cw - 4, h);
    }
    ctx.fillStyle = "hsla(40, 100%, 70%, 0.65)";
    ctx.font = "10px monospace";
    ctx.fillText(`FM:${params.fmAmount.toFixed(0)} MORPH:${params.morph.toFixed(2)} DRV:${params.tubeDrive.toFixed(2)}`, 8, 16);
  }, [params]);
  return <canvas ref={ref} width={360} height={110} className="w-full h-[110px] rounded-lg" />;
}

// ─── Main tab ──────────────────────────────────────────────────────────────

export function ProdTab() {
  const [params, setParams] = useState<ProdParams>({ ...DEFAULTS });
  const [activePreset, setActivePreset] = useState<string>("RESET");
  const [buffer, setBuffer] = useState<AudioBuffer | null>(null);
  const [rendering, setRendering] = useState(false);
  const [stereo, setStereo] = useState(true);
  const [tubeActivity, setTubeActivity] = useState<number[]>([0, 0, 0, 0]);
  const playerCtxRef = useRef<AudioContext | null>(null);
  const currentSrcRef = useRef<AudioBufferSourceNode | null>(null);

  const setParam = useCallback(<K extends keyof ProdParams>(k: K, v: ProdParams[K]) => {
    setParams((p) => ({ ...p, [k]: v }));
    setActivePreset("");
  }, []);

  const applyPreset = useCallback((name: string) => {
    const def = PRESETS[name];
    if (!def) return;
    setParams((p) => ({ ...DEFAULTS, ...p, ...def.p } as ProdParams));
    setActivePreset(name);
  }, []);

  const randomize = useCallback(() => {
    const r = (min: number, max: number, log = false) => {
      if (log) {
        const ln = Math.log(Math.max(min, 1e-6)), lx = Math.log(Math.max(max, 1e-6));
        return Math.exp(ln + Math.random() * (lx - ln));
      }
      return min + Math.random() * (max - min);
    };
    setParams({
      baseFreq: r(40, 1200, true), duration: r(0.1, 1.5), volume: 0.8,
      lpf: r(800, 16000, true), res: r(0.3, 6), hpf: r(20, 600, true),
      attack: r(0.001, 0.05), decay: r(0.05, 0.5), sustain: r(0, 0.7), release: r(0.05, 0.6),
      pitchEnv: r(-1200, 1200), fmAmount: r(0, 800), fmRatio: r(0.5, 5), morph: r(0, 1),
      noise: r(0, 0.5), tubeDrive: r(0.1, 0.7), bitcrush: r(0, 0.3), reverb: r(0, 0.4), width: r(0, 0.7),
    });
    setActivePreset("");
  }, []);

  const mutate = useCallback(() => {
    setParams((p) => {
      const j = (v: number, d: number, min: number, max: number) =>
        Math.max(min, Math.min(max, v + (Math.random() * 2 - 1) * d));
      return {
        ...p,
        baseFreq: j(p.baseFreq, p.baseFreq * 0.2, 30, 2000),
        fmAmount: j(p.fmAmount, 80, 0, 1500),
        fmRatio: j(p.fmRatio, 0.5, 0.25, 8),
        morph: j(p.morph, 0.15, 0, 1),
        tubeDrive: j(p.tubeDrive, 0.1, 0, 1),
        lpf: j(p.lpf, p.lpf * 0.2, 200, 20000),
        decay: j(p.decay, 0.08, 0, 1.5),
        pitchEnv: j(p.pitchEnv, 300, -2400, 2400),
      };
    });
    setActivePreset("");
  }, []);

  const render = useCallback(async () => {
    setRendering(true);
    try {
      const buf = await renderSample(params, { stereo, sampleRate: 48000 });
      setBuffer(buf);
      // Drive tube heatmap based on params for visual life.
      setTubeActivity([
        Math.min(1, params.tubeDrive * 0.7 + params.fmAmount / 1500 * 0.5),
        Math.min(1, params.tubeDrive * 0.8 + params.morph * 0.4),
        Math.min(1, params.tubeDrive * 0.6 + params.bitcrush * 0.6),
        Math.min(1, params.tubeDrive * 0.9 + params.noise * 0.4),
      ]);
    } finally {
      setRendering(false);
    }
  }, [params, stereo]);

  const play = useCallback(async () => {
    let buf = buffer;
    if (!buf) {
      buf = await renderSample(params, { stereo, sampleRate: 48000 });
      setBuffer(buf);
    }
    if (!playerCtxRef.current) {
      const Ctor = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
      playerCtxRef.current = new Ctor();
    }
    const ctx = playerCtxRef.current;
    if (ctx.state === "suspended") await ctx.resume();
    if (currentSrcRef.current) {
      try { currentSrcRef.current.stop(); } catch { /* */ }
    }
    // Recreate buffer in the playback ctx if SR mismatch.
    const playBuf = ctx.createBuffer(buf.numberOfChannels, buf.length, buf.sampleRate);
    for (let c = 0; c < buf.numberOfChannels; c++) playBuf.getChannelData(c).set(buf.getChannelData(c));
    const src = ctx.createBufferSource();
    src.buffer = playBuf;
    src.connect(ctx.destination);
    src.start();
    currentSrcRef.current = src;
  }, [buffer, params, stereo]);

  const download = useCallback(() => {
    if (!buffer) return;
    const blob = bufferToWavBlob(buffer);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const name = (activePreset || "SAMPLE").toLowerCase();
    a.href = url; a.download = `prod_${name}_${Date.now()}.wav`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [buffer, activePreset]);

  // Auto-render on mount.
  useEffect(() => { void render(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  return (
    <div className="space-y-3 pb-4">
      {/* Outer "wood + metal" chassis */}
      <div
        className="rounded-3xl p-3 sm:p-4"
        style={{
          background:
            "linear-gradient(90deg, rgba(0,0,0,.25) 0%, transparent 20%, rgba(255,255,255,.03) 40%, transparent 60%, rgba(0,0,0,.3) 100%)," +
            "repeating-linear-gradient(90deg,#5a331f 0px,#3d2215 18px,#5a331f 36px,#2e1a0f 54px,#5a331f 72px)",
          boxShadow: "inset 0 0 40px #000, inset 0 0 80px rgba(0,0,0,0.8), 0 20px 50px rgba(0,0,0,0.6)",
        }}
      >
        <div
          className="relative rounded-2xl p-3 sm:p-5"
          style={{
            background:
              "repeating-linear-gradient(90deg,transparent 0px,rgba(255,255,255,.02) 1px,transparent 2px,transparent 4px)," +
              "linear-gradient(180deg,#2f3542 0%,#1e222b 100%)",
            border: "2px solid #0b0e13",
            boxShadow: "inset 0 2px 0 rgba(255,255,255,.06), inset 0 -2px 0 rgba(0,0,0,.8), inset 0 0 30px rgba(0,0,0,.6)",
          }}
        >
          {/* Corner screws */}
          {[
            "top-3 left-3", "top-3 right-3", "bottom-3 left-3", "bottom-3 right-3",
          ].map((pos) => (
            <div key={pos} className={cn("absolute w-4 h-4 rounded-full pointer-events-none", pos)}
              style={{
                background: "radial-gradient(circle at 30% 30%, #9a9da4, #3a3f48 60%, #1a1e24)",
                boxShadow: "inset 0 1px 2px rgba(255,255,255,.3), inset 0 -2px 3px #000, 0 1px 3px rgba(0,0,0,.8)",
                border: "1px solid #0a0c0f",
              }}
            />
          ))}

          {/* Header */}
          <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="font-display text-[20px] sm:text-[26px] leading-none text-cyan-300 tracking-wider"
                style={{ textShadow: "0 0 12px hsl(180 100% 55% / 0.6)" }}>
                SAMPLE PRODUCER <span className="text-fuchsia-400" style={{ textShadow: "0 0 10px hsl(290 90% 65% / 0.8)" }}>MASCHINE</span>
              </h2>
              <p className="font-mono text-[10px] text-cyan-100/50 tracking-[0.3em] mt-1">FM • MORPH • TUBE • PROCEDURAL ONE-SHOT FORGE</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {Object.keys(PRESETS).map((name) => (
                <button
                  key={name}
                  onClick={() => applyPreset(name)}
                  className={cn(
                    "font-mono text-[11px] px-2.5 py-1 rounded-md border transition-all",
                    activePreset === name
                      ? "bg-fuchsia-500/15 border-fuchsia-400/60 text-fuchsia-200 shadow-[0_0_14px_hsl(290_90%_60%/0.4)]"
                      : "bg-[#0b1220] border-cyan-400/25 text-cyan-300 hover:border-cyan-300/60 hover:text-cyan-100 shadow-[0_0_10px_hsl(180_100%_50%/0.15),inset_0_0_10px_hsl(180_100%_50%/0.05)]"
                  )}
                >
                  {name}
                </button>
              ))}
              <button
                onClick={mutate}
                className="font-mono text-[11px] px-2.5 py-1 rounded-md border border-amber-400/40 text-amber-300 hover:text-amber-200 bg-[#1a0d04] shadow-[0_0_10px_hsl(38_100%_55%/0.25)]"
              >MUTATE</button>
              <button
                onClick={randomize}
                className="font-mono text-[11px] px-2.5 py-1 rounded-md border border-emerald-400/40 text-emerald-300 hover:text-emerald-200 bg-[#04140d] shadow-[0_0_10px_hsl(155_90%_50%/0.25)]"
              >RANDOM</button>
            </div>
          </header>

          {/* Main grid */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
            {/* LEFT: KNOBS */}
            <div className="xl:col-span-8">
              <div className="bg-black/60 rounded-2xl p-3 sm:p-4 border border-cyan-900/40"
                style={{ boxShadow: "inset 0 0 30px hsl(180 100% 50% / 0.03)" }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="font-display text-[13px] text-cyan-400 tracking-[0.2em]">PROCEDURAL SAMPLE ENGINE</span>
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-cyan-950/60 text-cyan-300 border border-cyan-800/50">
                      {stereo ? "STEREO" : "MONO"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setStereo((s) => !s)}
                      className="font-mono text-[10px] px-2 py-1 rounded border border-cyan-700/50 text-cyan-300 hover:text-cyan-100"
                    >
                      {stereo ? "→ MONO" : "→ STEREO"}
                    </button>
                    <button
                      onClick={() => void render()}
                      disabled={rendering}
                      className="font-mono text-[11px] px-3 py-1.5 rounded-md border border-cyan-400/50 text-cyan-200 bg-cyan-950/40 hover:bg-cyan-900/40 disabled:opacity-50"
                      style={{ boxShadow: "0 0 14px hsl(180 100% 50% / 0.25), inset 0 1px 0 rgba(255,255,255,.1)" }}
                    >
                      {rendering ? "..." : "RENDER"}
                    </button>
                    <button
                      onClick={() => void play()}
                      className="font-display text-[13px] tracking-widest px-5 py-1.5 rounded-md text-white"
                      style={{
                        background: "linear-gradient(180deg,#86198f,#4a044e)",
                        border: "1px solid #c026d3",
                        boxShadow: "0 0 20px hsl(290 90% 60% / 0.5), inset 0 1px 0 rgba(255,255,255,.2)",
                        textShadow: "0 0 8px rgba(255,255,255,.5)",
                      }}
                    >PLAY</button>
                  </div>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-x-2 gap-y-4">
                  {KNOBS.map((def) => (
                    <Knob key={def.k} def={def} value={params[def.k]} onChange={(v) => setParam(def.k, v)} />
                  ))}
                </div>

                {/* Export bar */}
                <div className="mt-5 p-3 rounded-xl bg-[#040a0f]/80 border border-cyan-900/40 flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3">
                    <span className="font-display text-[12px] text-cyan-400 tracking-[0.2em]">EXPORT</span>
                    <span className="font-mono text-[10px] text-cyan-200/60">
                      {buffer
                        ? `${buffer.numberOfChannels}ch • ${buffer.sampleRate / 1000}kHz • ${(buffer.duration * 1000).toFixed(0)}ms`
                        : "— render to enable —"}
                    </span>
                  </div>
                  <button
                    onClick={download}
                    disabled={!buffer}
                    className="font-mono text-[11px] px-3 py-1.5 rounded-md border border-amber-400/50 text-amber-200 bg-amber-950/30 hover:bg-amber-900/30 disabled:opacity-40"
                    style={{ boxShadow: "0 0 12px hsl(38 100% 55% / 0.3)" }}
                  >
                    DOWNLOAD .WAV
                  </button>
                </div>
              </div>
            </div>

            {/* RIGHT: VIZ */}
            <div className="xl:col-span-4 space-y-3">
              <div className="p-2 rounded-xl border border-cyan-900/40 bg-black/70"
                style={{ boxShadow: "inset 0 0 20px rgba(0,0,0,.8)" }}>
                <div className="flex justify-between items-center mb-1 px-1">
                  <span className="font-display text-[11px] text-fuchsia-300 tracking-widest">WAVEFORM</span>
                  <span className="font-mono text-[9px] text-cyan-300/70">RMS BARS</span>
                </div>
                <Spectrum buffer={buffer} />
              </div>

              <div className="p-2 rounded-xl border border-amber-900/50 bg-black/70"
                style={{ boxShadow: "inset 0 0 20px rgba(0,0,0,.8)" }}>
                <div className="flex justify-between items-center mb-1 px-1">
                  <span className="font-display text-[11px] text-amber-300 tracking-widest">STIMULIERENDE FREQUENZ-MAP</span>
                  <span className="font-mono text-[9px] text-amber-200/60">TUBE HEATMAP</span>
                </div>
                <HeatMap params={params} />
              </div>
            </div>
          </div>

          {/* TUBES */}
          <div
            className="mt-4 rounded-2xl p-3 border border-amber-950/60"
            style={{
              background: "linear-gradient(180deg,#0a0500,rgba(0,0,0,0.9))",
              boxShadow: "inset 0 0 40px rgba(0,0,0,0.9)",
            }}
          >
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="font-display text-[13px] text-amber-400 tracking-[0.2em]"
                style={{ textShadow: "0 0 8px hsl(38 100% 50% / 0.7)" }}>VIBEVALVE TUBES</span>
              <span className="font-mono text-[10px] text-amber-200/50 tracking-widest">V1 • V2 • V3 • V4 • SATURATION MATRIX</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 place-items-center">
              {[1, 2, 3, 4].map((i) => (
                <Tube key={i} idx={i} activity={tubeActivity[i - 1] ?? 0} />
              ))}
            </div>
          </div>

          <div className="mt-3 text-center font-mono text-[10px] text-cyan-100/30 tracking-widest">
            QUANTUM AUDIO LABS • DARK MATTER SERIES • SAMPLE PRODUCER MASCHINE
          </div>
        </div>
      </div>
    </div>
  );
}