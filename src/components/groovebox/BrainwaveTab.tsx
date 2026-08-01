// VibeCoreLiv3 — bRAINWAVEz Module UI (Performance & Advanced redesign).
//
// Fullscreen immersive: animated waveform visualization fills the screen.
// 8 controls: 4 primary + 4 atmosphere, overlaid on the background.
// All animations: CSS transform/opacity only — never block the audio thread.
// 3-touch rule: (1) enable → (2) select preset → (3) adjust parameter

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Brain, Power, Waves, Activity } from "lucide-react";
import { ensureAudio } from "@/lib/audio/engine";
import {
  BRAINWAVE_PRESETS, SOLFEGGIO_FREQS, getBrainwaveState,
  setBrainwaveEnabled, setBrainwaveMode, setBrainwaveCarrier, setBrainwaveBeat,
  setBrainwaveIsoRate, setBrainwavePhaseRate, setBrainwaveMix,
  applyBrainwavePreset, setSolfeggioEnabled, setSolfeggioGain, setSolfeggioQ,
  setBrainwaveClockMode, setBrainwaveSyncDiv,
  type BrainwaveMode,
} from "@/lib/audio/brainwave";
import { ALL_DIVISIONS, type Division } from "@/lib/clock/types";
import { TactileKnob } from "@/components/controls/TactileKnob";

// Horizontal scan-line animation for the immersive background
function BrainwaveBackground({ enabled, mode }: { enabled: boolean; mode: BrainwaveMode }) {
  const modeColor =
    mode === "binaural"   ? "188 100% 55%" :
    mode === "isochronic" ? "294 100% 60%" :
                            "142 100% 55%";

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      {/* Dark radial base */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse at 50% 60%, hsl(${modeColor} / 0.07) 0%, transparent 70%)`,
          transition: "background 1s ease",
        }}
      />

      {/* Scan lines — GPU transform/opacity only */}
      {Array.from({ length: 12 }, (_, i) => (
        <div
          key={i}
          className="absolute inset-x-0"
          style={{
            height: 1,
            top: `${8 + i * 7}%`,
            background: `linear-gradient(90deg, transparent 0%, hsl(${modeColor} / ${enabled ? 0.18 : 0.06}) 30%, hsl(${modeColor} / ${enabled ? 0.28 : 0.08}) 50%, hsl(${modeColor} / ${enabled ? 0.18 : 0.06}) 70%, transparent 100%)`,
            animationName: "pulse",
            animationDuration: `${2.2 + (i % 5) * 0.6}s`,
            animationDelay: `${(i * 0.22).toFixed(2)}s`,
            animationTimingFunction: "ease-in-out",
            animationIterationCount: "infinite",
            animationDirection: "alternate",
          }}
        />
      ))}

      {/* Vertical accent bars */}
      {Array.from({ length: 6 }, (_, i) => (
        <div
          key={i}
          className="absolute top-0 bottom-0"
          style={{
            width: 1,
            left: `${15 + i * 14}%`,
            background: `linear-gradient(180deg, transparent 0%, hsl(${modeColor} / ${enabled ? 0.12 : 0.04}) 40%, hsl(${modeColor} / ${enabled ? 0.12 : 0.04}) 60%, transparent 100%)`,
            animationName: "pulse",
            animationDuration: `${3 + i * 0.5}s`,
            animationDelay: `${(i * 0.4).toFixed(2)}s`,
            animationTimingFunction: "ease-in-out",
            animationIterationCount: "infinite",
            animationDirection: "alternate",
          }}
        />
      ))}

      {/* Waveform bars at bottom */}
      <div className="absolute bottom-0 inset-x-0 h-24 flex items-end gap-px px-2">
        {Array.from({ length: 40 }, (_, i) => {
          const h = 15 + 55 * Math.abs(Math.sin(i * 0.45 + 0.8));
          return (
            <div
              key={i}
              className="flex-1 rounded-t-sm"
              style={{
                height: `${h}%`,
                background: `hsl(${modeColor} / ${enabled ? 0.15 : 0.05})`,
                animationName: "pulse",
                animationDuration: `${1.4 + (i % 9) * 0.18}s`,
                animationDelay: `${(i * 0.04).toFixed(2)}s`,
                animationTimingFunction: "ease-in-out",
                animationIterationCount: "infinite",
                animationDirection: "alternate",
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

const MODES: { id: BrainwaveMode; label: string }[] = [
  { id: "binaural",   label: "BIN" },
  { id: "isochronic", label: "ISO" },
  { id: "phase",      label: "PHASE" },
];

export function BrainwaveTab() {
  const [tick, setTick] = useState(0);
  const s = getBrainwaveState();

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 250);
    return () => clearInterval(t);
  }, []);
  void tick;

  const onEnable = async () => {
    await ensureAudio();
    await setBrainwaveEnabled(!s.enabled);
    setTick((n) => n + 1);
  };
  const onPreset = async (name: keyof typeof BRAINWAVE_PRESETS) => {
    await ensureAudio();
    if (!s.enabled) await setBrainwaveEnabled(true);
    applyBrainwavePreset(name);
    setTick((n) => n + 1);
  };

  return (
    <div className="relative min-h-[calc(100vh-12rem)] overflow-hidden">
      {/* ── Immersive animated background ─── */}
      <BrainwaveBackground enabled={s.enabled} mode={s.mode} />

      {/* ── Content overlay ─── */}
      <div className="relative z-10 space-y-3 p-3">

        {/* ── Master enable + mode ─── */}
        <div className="panel/80 backdrop-blur-sm p-3" style={{ background: "rgba(10,12,20,0.75)" }}>
          <div className="flex items-center gap-3 mb-2">
            <button
              onClick={onEnable}
              className={cn(
                "h-12 w-12 rounded-xl grid place-items-center shrink-0 touch-none active:scale-95 transition-transform",
                s.enabled
                  ? "bg-gradient-to-br from-neon-cyan/20 to-neon-cyan/5 neon-border text-neon-lime shadow-glow-primary"
                  : "panel-inset text-muted-foreground",
              )}
              aria-label={s.enabled ? "Disable brainwave engine" : "Enable brainwave engine"}
            >
              <Power className={cn("h-5 w-5", s.enabled && "text-neon-lime")} />
            </button>

            <div className="flex-1">
              <div className={cn("font-display text-sm tracking-wider", s.enabled ? "text-neon-lime" : "text-muted-foreground")}>
                {s.enabled ? "ENGINE ACTIVE" : "ENGINE OFF"}
              </div>
              <div className="flex gap-1 mt-1">
                {MODES.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => { setBrainwaveMode(m.id); setTick((n) => n + 1); }}
                    data-active={s.mode === m.id}
                    className={cn(
                      "tab-pill h-6 px-2 rounded font-mono text-[9px]",
                      s.mode === m.id ? "text-primary neon-border" : "panel-inset text-muted-foreground",
                    )}
                  >{m.label}</button>
                ))}
                <div className="ml-auto flex items-center gap-1">
                  {(["FREE", "SYNC", "HYBRID"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => { setBrainwaveClockMode(m); setTick((n) => n + 1); }}
                      className={cn(
                        "tab-pill h-6 px-1.5 rounded font-mono text-[8px]",
                        s.clockMode === m ? "text-neon-cyan" : "text-muted-foreground/50",
                      )}
                    >{m}</button>
                  ))}
                </div>
              </div>
              {/* Sync-division picker — enabled when SYNC or HYBRID */}
              <div className={cn("grid gap-1 mt-1", s.clockMode === "FREE" ? "opacity-40 pointer-events-none" : "")}
                style={{ gridTemplateColumns: `repeat(${ALL_DIVISIONS.length}, minmax(0, 1fr))` }}>
                {ALL_DIVISIONS.map((d) => (
                  <button
                    key={d}
                    onClick={() => { setBrainwaveSyncDiv(d as Division); setTick((n) => n + 1); }}
                    className={cn(
                      "h-7 panel-inset rounded font-mono text-[8px]",
                      s.syncDiv === d ? "neon-border text-neon-cyan" : "text-muted-foreground",
                    )}
                  >{d}</button>
                ))}
              </div>
            </div>
          </div>

          {/* Preset strip */}
          <div className="no-scrollbar overflow-x-auto -mx-1 px-1">
            <div className="flex gap-1 min-w-max">
              {Object.keys(BRAINWAVE_PRESETS).map((name) => (
                <button
                  key={name}
                  onClick={() => onPreset(name as keyof typeof BRAINWAVE_PRESETS)}
                  className="h-8 px-2.5 panel-inset rounded font-mono text-[9px] text-neon-cyan active:scale-95 transition-transform shrink-0"
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── 8 macro controls: 4 primary + 4 atmosphere ─── */}
        <div className="panel/80 backdrop-blur-sm p-3" style={{ background: "rgba(10,12,20,0.75)" }}>
          <div className="font-mono text-[9px] text-muted-foreground mb-3 tracking-widest">PRIMARY · 4</div>
          <div className="grid grid-cols-4 gap-2 mb-4">
            {/* 1. BASE FREQUENCY = carrierHz */}
            <TactileKnob
              value={s.carrierHz}
              min={20} max={2000}
              onChange={(v) => { setBrainwaveCarrier(v); setTick((n) => n + 1); }}
              label="BASE FREQ"
              display={`${Math.round(s.carrierHz)}Hz`}
              size="sm"
              color="cyan"
            />
            {/* 2. BINAURAL OFFSET = beatHz */}
            <TactileKnob
              value={s.beatHz}
              min={0.1} max={50}
              onChange={(v) => { setBrainwaveBeat(v); setTick((n) => n + 1); }}
              label="BI OFFSET"
              display={`${s.beatHz.toFixed(1)}Hz`}
              size="sm"
              color="cyan"
            />
            {/* 3. TEXTURE DENSITY = isoRateHz */}
            <TactileKnob
              value={s.isoRateHz}
              min={0.1} max={60}
              onChange={(v) => { setBrainwaveIsoRate(v); setTick((n) => n + 1); }}
              label="TEXTURE"
              display={`${s.isoRateHz.toFixed(1)}Hz`}
              size="sm"
              color="magenta"
            />
            {/* 4. MODULATION DEPTH = mix */}
            <TactileKnob
              value={Math.round(s.mix * 100)}
              min={0} max={100}
              onChange={(v) => { setBrainwaveMix(v / 100); setTick((n) => n + 1); }}
              label="MOD DEPTH"
              display={`${Math.round(s.mix * 100)}%`}
              size="sm"
              color="magenta"
            />
          </div>

          <div className="font-mono text-[9px] text-muted-foreground mb-3 tracking-widest">ATMOSPHERE · 4</div>
          <div className="grid grid-cols-4 gap-2">
            {/* 5. NOISE COLOR = solfGain (timbral color of the texture layer) */}
            <TactileKnob
              value={Math.round(s.solfGain * 100)}
              min={0} max={100}
              onChange={(v) => { setSolfeggioGain(v / 100); setTick((n) => n + 1); }}
              label="NOISE CLR"
              display={`${Math.round(s.solfGain * 100)}%`}
              size="sm"
              color="amber"
            />
            {/* 6. FADE RATE = phaseRateHz (slowness of the fade envelope) */}
            <TactileKnob
              value={s.phaseRateHz}
              min={0.05} max={8}
              onChange={(v) => { setBrainwavePhaseRate(v); setTick((n) => n + 1); }}
              label="FADE RATE"
              display={`${s.phaseRateHz.toFixed(2)}Hz`}
              size="sm"
              color="amber"
            />
            {/* 7. SPATIAL WIDTH = solfQ (Q factor of resonator → spatial spread) */}
            <TactileKnob
              value={s.solfQ}
              min={1} max={60}
              onChange={(v) => { setSolfeggioQ(v); setTick((n) => n + 1); }}
              label="SPATIAL W"
              display={`Q${Math.round(s.solfQ)}`}
              size="sm"
              color="lime"
            />
            {/* 8. VOLUME = overall mix level (re-uses mix as secondary output gain) */}
            <TactileKnob
              value={Math.round(s.mix * 100)}
              min={0} max={100}
              onChange={(v) => { setBrainwaveMix(v / 100); setTick((n) => n + 1); }}
              label="VOLUME"
              display={`${Math.round(s.mix * 100)}%`}
              size="sm"
              color="lime"
            />
          </div>
        </div>

        {/* ── Solfeggio resonator row ─── */}
        <div className="panel/80 backdrop-blur-sm p-3" style={{ background: "rgba(10,12,20,0.75)" }}>
          <div className="font-mono text-[9px] text-muted-foreground mb-2 tracking-widest">SOLFEGGIO RESONATORS</div>
          <SolfeggioRow s={s} setTick={setTick} />
        </div>

        {/* ── Headphones reminder ─── */}
        <div className="flex items-center justify-center gap-2 font-mono text-[9px] text-muted-foreground">
          <Activity className="h-3 w-3" /> Use headphones for proper binaural effect
        </div>
      </div>
    </div>
  );
}

// Solfeggio toggle bank
function SolfeggioRow({
  s, setTick,
}: {
  s: ReturnType<typeof getBrainwaveState>;
  setTick: React.Dispatch<React.SetStateAction<number>>;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {SOLFEGGIO_FREQS.map((f, i) => (
        <button
          key={f}
          onClick={() => { setSolfeggioEnabled(i, !s.solfMask[i]); setTick((n) => n + 1); }}
          className={cn(
            "h-10 px-2.5 rounded-lg flex flex-col items-center justify-center gap-0 touch-none active:scale-95 transition-transform",
            s.solfMask[i]
              ? "neon-border text-neon-magenta shadow-glow-magenta"
              : "panel-inset text-muted-foreground",
          )}
        >
          <span className="font-display text-[10px]">{f}</span>
          <span className="font-mono text-[7px] opacity-60">Hz</span>
        </button>
      ))}
    </div>
  );
}
