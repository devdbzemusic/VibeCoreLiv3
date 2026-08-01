// Pure procedural sample renderer used by ProdTab + its Web Worker.
// No DOM / no AudioContext — produces Float32Array channels deterministically
// so the heavy synthesis loop can run off-thread on low-end Android devices.

export interface ProdParams {
  baseFreq: number; duration: number; volume: number;
  lpf: number; res: number; hpf: number;
  attack: number; decay: number; sustain: number; release: number;
  pitchEnv: number; fmAmount: number; fmRatio: number; morph: number;
  noise: number; tubeDrive: number; bitcrush: number; reverb: number; width: number;
}

export interface ProdRenderResult {
  sampleRate: number;
  length: number;
  channels: Float32Array[]; // length 1 (mono) or 2 (stereo)
}

export interface ProdRenderOptions {
  stereo?: boolean;
  sampleRate?: number;
}

export function renderProdSample(p: ProdParams, opts: ProdRenderOptions = {}): ProdRenderResult {
  const sr = opts.sampleRate ?? 48000;
  const len = Math.max(1, Math.floor(p.duration * sr));
  const numCh = opts.stereo ? 2 : 1;
  const channels: Float32Array[] = [];
  for (let c = 0; c < numCh; c++) channels.push(new Float32Array(len));

  let seed = Math.floor(p.baseFreq * 1000 + p.fmAmount + p.morph * 999);
  const rnd = () => { seed = (seed * 1664525 + 1013904223) | 0; return ((seed >>> 0) / 0xffffffff) * 2 - 1; };

  // ADSR envelope.
  const env = new Float32Array(len);
  const aN = Math.max(1, Math.floor(p.attack * sr));
  const dN = Math.max(1, Math.floor(p.decay * sr));
  const rN = Math.max(1, Math.floor(p.release * sr));
  const sN = Math.max(0, len - aN - dN - rN);
  let i = 0;
  for (let n = 0; n < aN && i < len; n++, i++) env[i] = (n + 1) / aN;
  for (let n = 0; n < dN && i < len; n++, i++) env[i] = 1 - (1 - p.sustain) * ((n + 1) / dN);
  for (let n = 0; n < sN && i < len; n++, i++) env[i] = p.sustain;
  for (let n = 0; n < rN && i < len; n++, i++) env[i] = p.sustain * (1 - (n + 1) / rN);
  while (i < len) { env[i++] = 0; }

  let lp1 = 0, bp1 = 0, lp2 = 0, bp2 = 0;
  let hp1L = 0, hpInL = 0, hp1R = 0, hpInR = 0;
  const Q = 1 / Math.max(0.1, p.res);

  const tube = (x: number, drive: number) => {
    const k = 1 + drive * 8;
    const y = Math.tanh(x * k) / Math.tanh(k * 0.5 + 0.5);
    return y * (1 - drive * 0.15) + (y * y) * drive * 0.2;
  };
  const crushBits = (x: number, amt: number) => {
    if (amt <= 0) return x;
    const bits = 16 - amt * 12;
    const steps = Math.pow(2, bits);
    return Math.round(x * steps) / steps;
  };

  let phC = 0, phM = 0;
  const TWO_PI = Math.PI * 2;
  const pitchAtN = (n: number) => {
    const t = n / len;
    const semi = (p.pitchEnv / 100) * Math.pow(1 - t, 2);
    return Math.pow(2, semi / 12);
  };

  const left = channels[0];
  const right = numCh === 2 ? channels[1] : null;
  const hpAlpha = Math.exp(-2 * Math.PI * p.hpf / sr);

  for (let n = 0; n < len; n++) {
    const e = env[n];
    const pitchMul = pitchAtN(n);
    const freq = p.baseFreq * pitchMul;
    const modFreq = freq * p.fmRatio;

    const mod = Math.sin(phM) * p.fmAmount;
    phM += (modFreq / sr) * TWO_PI;
    if (phM > TWO_PI) phM -= TWO_PI;

    const ph = phC + (mod / sr) * TWO_PI;
    const sine = Math.sin(ph);
    const saw = 2 * ((ph / TWO_PI) - Math.floor(ph / TWO_PI + 0.5));
    const sq = sine >= 0 ? 1 : -1;
    let osc: number;
    if (p.morph < 0.5) osc = sine * (1 - p.morph * 2) + saw * (p.morph * 2);
    else osc = saw * (1 - (p.morph - 0.5) * 2) + sq * ((p.morph - 0.5) * 2);
    phC += (freq / sr) * TWO_PI;
    if (phC > TWO_PI) phC -= TWO_PI;

    const noise = rnd() * p.noise;
    let s = (osc * (1 - p.noise * 0.5) + noise) * e * p.volume;

    const f = Math.min(0.45, 2 * Math.sin(Math.PI * Math.min(p.lpf, sr * 0.45) / sr));
    lp1 = lp1 + f * bp1;
    const hpv1 = s - lp1 - Q * bp1;
    bp1 = bp1 + f * hpv1;
    s = lp1;

    const xL = s;
    hp1L = hpAlpha * (hp1L + xL - hpInL);
    hpInL = xL;
    s = hp1L;

    s = tube(s, p.tubeDrive);
    s = crushBits(s, p.bitcrush);

    if (right) {
      const off = Math.sin(n * 0.0007 + p.width * 3) * p.width * 0.6;
      const phR = phC + off;
      const sineR = Math.sin(phR);
      const sawR = 2 * ((phR / TWO_PI) - Math.floor(phR / TWO_PI + 0.5));
      const sqR = sineR >= 0 ? 1 : -1;
      let oscR: number;
      if (p.morph < 0.5) oscR = sineR * (1 - p.morph * 2) + sawR * (p.morph * 2);
      else oscR = sawR * (1 - (p.morph - 0.5) * 2) + sqR * ((p.morph - 0.5) * 2);
      let r = (oscR * (1 - p.noise * 0.5) + rnd() * p.noise) * e * p.volume;
      lp2 = lp2 + f * bp2;
      const hpv2 = r - lp2 - Q * bp2;
      bp2 = bp2 + f * hpv2;
      r = lp2;
      hp1R = hpAlpha * (hp1R + r - hpInR);
      hpInR = r;
      r = tube(hp1R, p.tubeDrive);
      r = crushBits(r, p.bitcrush);

      const mid = (s + r) * 0.5;
      const side = (s - r) * 0.5 * (1 + p.width * 1.2);
      left[n] = mid + side;
      right[n] = mid - side;
    } else {
      left[n] = s;
    }
  }

  if (p.reverb > 0.001) applyReverb(channels, sr, p.reverb);

  // Soft-normalize.
  let peak = 0;
  for (let c = 0; c < numCh; c++) {
    const d = channels[c];
    for (let n = 0; n < len; n++) { const a = Math.abs(d[n]); if (a > peak) peak = a; }
  }
  if (peak > 0.99) {
    const g = 0.99 / peak;
    for (let c = 0; c < numCh; c++) {
      const d = channels[c];
      for (let n = 0; n < len; n++) d[n] *= g;
    }
  }
  return { sampleRate: sr, length: len, channels };
}

function applyReverb(channels: Float32Array[], sr: number, amount: number): void {
  const taps = [1117, 1188, 1277, 1356, 1422, 1491, 1557, 1617].map((x) => Math.floor(x * sr / 44100));
  const fb = 0.5 + amount * 0.35;
  const wet = amount * 0.6;
  for (let c = 0; c < channels.length; c++) {
    const d = channels[c];
    const tmp = new Float32Array(d.length);
    for (let n = 0; n < d.length; n++) {
      let acc = 0;
      for (let t = 0; t < taps.length; t++) {
        const idx = n - taps[t] - c * 7;
        if (idx >= 0) acc += tmp[idx] * fb;
      }
      tmp[n] = d[n] + acc / taps.length;
      d[n] = d[n] * (1 - wet) + tmp[n] * wet;
    }
  }
}
