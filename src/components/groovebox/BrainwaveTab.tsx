// Phase 6+7 — Brainwave + Solfeggio UI.
// Sits at /BRN tab. All controls map 1:1 onto the engine setters.

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Brain, Power, Waves, Activity, Sparkles } from "lucide-react";
import { ensureAudio } from "@/lib/audio/engine";
import {
  BRAINWAVE_PRESETS, SOLFEGGIO_FREQS, getBrainwaveState,
  setBrainwaveEnabled, setBrainwaveMode, setBrainwaveCarrier, setBrainwaveBeat,
  setBrainwaveIsoRate, setBrainwavePhaseRate, setBrainwaveMix,
  applyBrainwavePreset, setSolfeggioEnabled, setSolfeggioGain, setSolfeggioQ,
  setBrainwaveClockMode, setBrainwaveSyncDiv,
  type BrainwaveMode, type BrainwaveClockMode,
} from "@/lib/audio/brainwave";
import { ALL_DIVISIONS, type Division } from "@/lib/clock/types";

const CLOCK_MODES: BrainwaveClockMode[] = ["FREE", "SYNC", "HYBRID"];

const MODES: { id: BrainwaveMode; label: string }[] = [
  { id: "binaural",   label: "BINAURAL" },
  { id: "isochronic", label: "ISOCHRONIC" },
  { id: "phase",      label: "STEREO PHASE" },
];

export function BrainwaveTab() {
  const [tick, setTick] = useState(0);
  const s = getBrainwaveState();

  // Force re-render after async setters (engine bootstrap).
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 250);
    return () => clearInterval(t);
  }, []);
  void tick;

  const onEnable = async () => { await ensureAudio(); await setBrainwaveEnabled(!s.enabled); setTick((n) => n + 1); };
  const onPreset = async (name: keyof typeof BRAINWAVE_PRESETS) => {
    await ensureAudio();
    if (!s.enabled) await setBrainwaveEnabled(true);
    applyBrainwavePreset(name);
    setTick((n) => n + 1);
  };

  return (
    <div className="space-y-3">
      {/* ─── Master / Preset bar ─────────────────────── */}
      <div className="panel p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="font-display text-xs text-primary flex items-center gap-2">
            <Brain className="h-3.5 w-3.5" /> BRAINWAVE ENGINE
          </div>
          <button
            onClick={onEnable}
            className={cn(
              "h-8 px-3 rounded panel-inset font-mono text-[10px] flex items-center gap-1.5",
              s.enabled ? "neon-border text-neon-lime" : "text-muted-foreground"
            )}
          >
            <Power className="h-3 w-3" /> {s.enabled ? "ENGINE ON" : "ENGINE OFF"}
          </button>
        </div>
        <div className="hairline mb-2" />
        <div className="grid grid-cols-6 gap-1">
          {Object.keys(BRAINWAVE_PRESETS).map((name) => (
            <button
              key={name}
              onClick={() => onPreset(name as keyof typeof BRAINWAVE_PRESETS)}
              className="h-9 panel-inset rounded font-mono text-[10px] text-neon-cyan active:scale-95 transition-transform"
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Mode selector ─────────────────────── */}
      <div className="panel p-3">
        <div className="font-display text-[11px] mb-2 text-neon-cyan flex items-center gap-1.5">
          <Waves className="h-3 w-3" /> GENERATOR MODE
        </div>
        <div className="grid grid-cols-3 gap-1">
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => { setBrainwaveMode(m.id); setTick((n) => n + 1); }}
              className={cn(
                "h-10 panel-inset rounded font-mono text-[10px]",
                s.mode === m.id ? "neon-border text-primary" : "text-muted-foreground"
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Clock coupling (FREE / SYNC / HYBRID) ─── */}
      <div className="panel p-3">
        <div className="font-display text-[11px] mb-2 text-neon-cyan">CLOCK COUPLING</div>
        <div className="grid grid-cols-3 gap-1 mb-2">
          {CLOCK_MODES.map((m) => (
            <button
              key={m}
              onClick={() => { setBrainwaveClockMode(m); setTick((n) => n + 1); }}
              className={cn(
                "h-9 panel-inset rounded font-mono text-[10px]",
                s.clockMode === m ? "neon-border text-primary" : "text-muted-foreground"
              )}
            >{m}</button>
          ))}
        </div>
        <div className={cn("grid grid-cols-5 gap-1", s.clockMode === "FREE" && "opacity-40 pointer-events-none")}>
          {ALL_DIVISIONS.map((d) => (
            <button
              key={d}
              onClick={() => { setBrainwaveSyncDiv(d as Division); setTick((n) => n + 1); }}
              className={cn(
                "h-8 panel-inset rounded font-mono text-[9px]",
                s.syncDiv === d ? "neon-border text-neon-cyan" : "text-muted-foreground"
              )}
            >{d}</button>
          ))}
        </div>
      </div>


      {/* ─── Frequency controls ─────────────────── */}
      <div className="panel p-3 space-y-2">
        <Knob label="CARRIER" unit="Hz" value={s.carrierHz}
          min={20} max={2000} step={1}
          onChange={(v) => { setBrainwaveCarrier(v); setTick((n) => n + 1); }} />
        <Knob label="BEAT Δ"  unit="Hz" value={s.beatHz}
          min={0.1} max={50} step={0.1}
          onChange={(v) => { setBrainwaveBeat(v); setTick((n) => n + 1); }} />
        <Knob label="ISO RATE" unit="Hz" value={s.isoRateHz}
          min={0.1} max={60} step={0.1}
          onChange={(v) => { setBrainwaveIsoRate(v); setTick((n) => n + 1); }}
          disabled={s.mode !== "isochronic"} />
        <Knob label="PHASE LFO" unit="Hz" value={s.phaseRateHz}
          min={0.05} max={8} step={0.01}
          onChange={(v) => { setBrainwavePhaseRate(v); setTick((n) => n + 1); }}
          disabled={s.mode !== "phase"} />
        <Knob label="MIX" unit="" value={Math.round(s.mix * 100)}
          min={0} max={100} step={1}
          onChange={(v) => { setBrainwaveMix(v / 100); setTick((n) => n + 1); }} />
      </div>

      {/* ─── Solfeggio Resonator Bank ─────────── */}
      <div className="panel p-3">
        <div className="font-display text-[11px] mb-2 text-neon-magenta flex items-center gap-1.5">
          <Sparkles className="h-3 w-3" /> SOLFEGGIO RESONATOR BANK
        </div>
        <div className="grid grid-cols-3 gap-1 mb-2">
          {SOLFEGGIO_FREQS.map((f, i) => (
            <button
              key={f}
              onClick={() => { setSolfeggioEnabled(i, !s.solfMask[i]); setTick((n) => n + 1); }}
              className={cn(
                "h-11 panel-inset rounded flex flex-col items-center justify-center gap-0.5",
                s.solfMask[i] ? "neon-border text-neon-magenta shadow-glow-magenta" : "text-muted-foreground"
              )}
            >
              <span className="font-display text-[11px]">{f}</span>
              <span className="font-mono text-[8px] opacity-60">Hz</span>
            </button>
          ))}
        </div>
        <Knob label="RES GAIN" unit="" value={Math.round(s.solfGain * 100)}
          min={0} max={100} step={1}
          onChange={(v) => { setSolfeggioGain(v / 100); setTick((n) => n + 1); }} />
        <Knob label="RES Q" unit="" value={s.solfQ}
          min={1} max={60} step={1}
          onChange={(v) => { setSolfeggioQ(v); setTick((n) => n + 1); }} />
      </div>

      <div className="font-mono text-[9px] text-muted-foreground text-center flex items-center justify-center gap-1">
        <Activity className="h-3 w-3" /> Use headphones for proper binaural effect.
      </div>
    </div>
  );
}

// ─── Tiny slider/knob row (matches existing tab aesthetic) ────────────────
interface KnobProps {
  label: string; unit: string; value: number;
  min: number; max: number; step: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}
function Knob({ label, unit, value, min, max, step, onChange, disabled }: KnobProps) {
  return (
    <label className={cn("flex items-center gap-2 font-mono text-[10px]", disabled && "opacity-40 pointer-events-none")}>
      <span className="w-20 text-primary">{label}</span>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 accent-primary"
      />
      <span className="w-14 text-right tabular-nums">
        {step < 1 ? value.toFixed(2) : value.toFixed(0)} {unit}
      </span>
    </label>
  );
}
