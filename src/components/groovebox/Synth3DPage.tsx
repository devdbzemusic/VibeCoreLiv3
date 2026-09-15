// VibeCoreLiv3 — 3D Synth Module Page.
//
// UX Rules: 8-parameter rule (max 8 macros visible), 3-touch rule.
// Primary surface: 4×2 TactileKnob grid (8 macros).
// Secondary panel: swipe-right / tap [›] button to reveal LFO, Detune, Width, Pan, Drive.
// Deep editor: collapsible Synth3DSubtab below.

import { useState, useEffect } from "react";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { useGroove } from "@/lib/store";
import { cn } from "@/lib/utils";
import { TactileKnob } from "@/components/controls/TactileKnob";
import { Synth3DSubtab } from "./Synth3DSubtab";
import { InstrumentKeyboard } from "./InstrumentKeyboard";
import { defaultSynth3D, type OscType3D } from "@/lib/synth3d/params";

// ── Osc-Shape cycling button styled like a knob cell ─────────────────────────
const OSC_TYPES: OscType3D[] = ["sine", "saw", "square", "triangle", "noise", "wavetable"];
const OSC_LABELS: Record<OscType3D, string> = {
  sine: "SINE", saw: "SAW", square: "SQR", triangle: "TRI", noise: "NOISE", wavetable: "WT",
};

type SoundDirection = "BRIGHT" | "DARK" | "PUNCH" | "DREAM";

const SOUND_DIRECTIONS: { key: SoundDirection; label: string; detail: string; color: string }[] = [
  { key: "BRIGHT", label: "BRIGHT", detail: "OPEN · CLEAR", color: "text-neon-cyan" },
  { key: "DARK", label: "DARK", detail: "WARM · DEEP", color: "text-neon-violet" },
  { key: "PUNCH", label: "PUNCH", detail: "HIT · DRIVE", color: "text-neon-amber" },
  { key: "DREAM", label: "DREAM", detail: "WIDE · AIR", color: "text-neon-lime" },
];

function OscShapeCell({ value, onChange }: { value: OscType3D; onChange: (t: OscType3D) => void }) {
  const idx = OSC_TYPES.indexOf(value);
  const cycle = () => onChange(OSC_TYPES[(idx + 1) % OSC_TYPES.length]);
  return (
    <div
      className="flex flex-col items-center gap-1 panel-inset rounded-md p-2 select-none touch-none cursor-pointer"
      onClick={cycle}
      role="button"
      aria-label="Osc Shape"
    >
      <div className="font-mono text-[8px] text-muted-foreground tracking-widest">SHAPE</div>
      <div className="h-14 w-14 rounded-full ring-knob grid place-items-center">
        <span className="font-display text-[10px] text-primary">{OSC_LABELS[value]}</span>
      </div>
      <div className="font-mono text-[9px] text-muted-foreground">{idx + 1}/{OSC_TYPES.length}</div>
    </div>
  );
}

// ── Secondary side panel ──────────────────────────────────────────────────────
function SecondaryPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { parts, selectedPart, setSynth3D } = useGroove();
  const p = parts[selectedPart];
  const s3d = p?.synth3d ?? defaultSynth3D();
  if (!p) return null;

  return (
    <div
      className={cn(
        "absolute inset-y-0 right-0 w-64 z-20 bg-surface-1 border-l border-border p-3 space-y-3 overflow-y-auto no-scrollbar transition-transform duration-300",
        open ? "translate-x-0" : "translate-x-full",
      )}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="font-display text-xs text-primary">SECONDARY</div>
        <button onClick={onClose} className="h-7 w-7 grid place-items-center panel-inset rounded">
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="hairline" />

      <div className="font-mono text-[8px] text-muted-foreground tracking-widest mb-1">LFO 1</div>
      <TactileKnob
        label="LFO RATE"
        value={s3d.lfos[0]?.rate ?? 1}
        min={0.01} max={20}
        onChange={(v) => {
          const lfos = s3d.lfos.slice();
          lfos[0] = { ...lfos[0], rate: v };
          setSynth3D(p.id, { lfos });
        }}
        size="sm" color="cyan"
        display={`${(s3d.lfos[0]?.rate ?? 1).toFixed(2)}Hz`}
      />

      <div className="hairline" />
      <div className="font-mono text-[8px] text-muted-foreground tracking-widest mb-1">OSCILLATOR</div>
      <div className="grid grid-cols-2 gap-2">
        <TactileKnob
          label="DETUNE"
          value={s3d.unison.detune}
          min={0} max={100}
          onChange={(v) => setSynth3D(p.id, { unison: { ...s3d.unison, detune: Math.round(v) } })}
          size="sm" color="amber"
          display={`${Math.round(s3d.unison.detune)}c`}
        />
        <TactileKnob
          label="DRIFT"
          value={s3d.unison.drift * 100}
          min={0} max={100}
          onChange={(v) => setSynth3D(p.id, { unison: { ...s3d.unison, drift: v / 100 } })}
          size="sm" color="amber"
          display={`${Math.round(s3d.unison.drift * 100)}Hz`}
        />
      </div>

      <div className="hairline" />
      <div className="font-mono text-[8px] text-muted-foreground tracking-widest mb-1">SPATIAL</div>
      <TactileKnob
        label="WIDTH"
        value={s3d.spatial.width * 50}
        min={0} max={100}
        onChange={(v) => setSynth3D(p.id, { spatial: { ...s3d.spatial, width: v / 50 } })}
        size="sm" color="magenta"
        display={`${Math.round(s3d.spatial.width * 100)}%`}
      />

      <div className="hairline" />
      <div className="font-mono text-[8px] text-muted-foreground tracking-widest mb-1">OSC PAN</div>
      <TactileKnob
        label="PAN"
        value={50 + s3d.osc1.pan * 50}
        min={0} max={100}
        defaultValue={50}
        onChange={(v) => setSynth3D(p.id, { osc1: { ...s3d.osc1, pan: (v - 50) / 50 } })}
        size="sm" color="lime"
        display={s3d.osc1.pan === 0 ? "C" : s3d.osc1.pan > 0 ? `R${Math.abs(Math.round(s3d.osc1.pan * 50))}` : `L${Math.abs(Math.round(s3d.osc1.pan * 50))}`}
      />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function Synth3DPage() {
  const {
    parts, selectedPart, selectPart, setSynthEngine, setPartSource,
    setSynth3D, setSend, setChannel, fx,
  } = useGroove();
  const [secondaryOpen, setSecondaryOpen] = useState(false);
  const [deepOpen, setDeepOpen] = useState(false);
  const [lastDirection, setLastDirection] = useState<SoundDirection | null>(null);

  useEffect(() => {
    const p = parts[selectedPart];
    if (p && p.category !== "synth") {
      const synthPart = parts.find((pt) => pt.category === "synth");
      if (synthPart) {
        selectPart(synthPart.id);
        return;
      }
    }
    if (p && p.synth.engine !== "3D") {
      setSynthEngine(p.id, "3D");
      setPartSource(p.id, "synth");
    }
    setLastDirection(null);
  }, [parts, selectedPart, selectPart, setSynthEngine, setPartSource]);

  const p = parts[selectedPart];
  const s3d = p?.synth3d ?? defaultSynth3D();
  if (!p) return null;

  // The FX bank is configurable. Resolve a real reverb bus instead of assuming
  // a fixed send index (the default first bus is Chorus, not Reverb).
  const configuredReverbBus = fx.findIndex((slot) => slot.type === "Hall Reverb" || slot.type === "Room Reverb");
  const reverbSendIndex = configuredReverbBus >= 0 ? configuredReverbBus : null;
  const reverbSend = reverbSendIndex === null ? 0 : p.sends[reverbSendIndex] ?? 0;
  const setReverbSend = (value: number) => {
    if (reverbSendIndex !== null) setSend(p.id, reverbSendIndex, value);
  };

  const applyDirection = (direction: SoundDirection) => {
    setLastDirection(direction);

    // Every direction is a partial patch: existing OSC2/sub voicing and all
    // untouched sound-design choices remain intact for the musician.
    switch (direction) {
      case "BRIGHT":
        setSynth3D(p.id, {
          osc1: { ...s3d.osc1, type: "saw" },
          filter1: { ...s3d.filter1, enabled: true, freq: 8000, q: 1.2 },
          ampEnv: { ...s3d.ampEnv, attack: 0.008, decay: 0.32, release: 0.22 },
        });
        setReverbSend(12);
        break;
      case "DARK":
        setSynth3D(p.id, {
          osc1: { ...s3d.osc1, type: "triangle" },
          filter1: { ...s3d.filter1, enabled: true, freq: 500, q: 2.4 },
          ampEnv: { ...s3d.ampEnv, attack: 0.55, decay: 1.1, release: 1.8 },
        });
        setReverbSend(68);
        break;
      case "PUNCH":
        setSynth3D(p.id, {
          osc1: { ...s3d.osc1, type: "square" },
          filter1: { ...s3d.filter1, enabled: true, freq: 2800, q: 4.2 },
          ampEnv: { ...s3d.ampEnv, attack: 0.003, decay: 0.18, sustain: 0.15, release: 0.07 },
        });
        setChannel(p.id, { drive: 68, driveType: "tube" });
        setReverbSend(8);
        break;
      case "DREAM":
        setSynth3D(p.id, {
          osc1: { ...s3d.osc1, type: "sine", level: Math.max(s3d.osc1.level, 0.65) },
          osc2: {
            ...s3d.osc2,
            type: "wavetable",
            enabled: true,
            level: Math.max(s3d.osc2.level, 0.38),
          },
          filter1: { ...s3d.filter1, enabled: true, freq: 2200, q: 0.8 },
          ampEnv: { ...s3d.ampEnv, attack: 1.1, decay: 1.4, sustain: 0.75, release: 2 },
          spatial: { ...s3d.spatial, enabled: true, mode: "binaural", width: 1.75 },
        });
        setReverbSend(76);
        break;
    }
  };

  return (
    <div className="relative space-y-3">
      {/* Voice picker */}
      <div className="panel p-2">
        <div className="font-mono text-[8px] text-muted-foreground tracking-widest mb-1.5">VOICE</div>
        <div className="no-scrollbar overflow-x-auto touch-scroll-x -mx-1 px-1">
          <div className="flex gap-1 min-w-max">
            {parts.map((pt) => (
              <button key={pt.id} onClick={() => selectPart(pt.id)}
                className={cn(
                  "shrink-0 h-11 min-w-[3.5rem] px-2 rounded panel-inset flex flex-col items-center justify-center gap-0.5",
                  pt.id === selectedPart && "neon-border text-primary")}>
                <span className="text-[7px] text-muted-foreground font-mono">{String(pt.id + 1).padStart(2, "0")}</span>
                <span className="font-display text-[9px] truncate w-full text-center">{pt.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 8 Macro knobs + direction picker + secondary panel toggle */}
      <div className="panel p-3">
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="font-display text-xs text-primary">MACRO · 8 PARAMS</div>
            <div className="font-mono text-[8px] text-muted-foreground tracking-widest mt-0.5">AI DIRECTION · LAST APPLIED</div>
          </div>
          <button
            onClick={() => setSecondaryOpen((o) => !o)}
            className={cn("h-7 w-7 grid place-items-center panel-inset rounded transition-colors",
              secondaryOpen && "neon-border text-primary")}
            aria-label="Secondary parameters"
          >
            {secondaryOpen ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-1.5 mb-3">
          {SOUND_DIRECTIONS.map((direction) => (
            <button
              key={direction.key}
              onClick={() => applyDirection(direction.key)}
              aria-pressed={lastDirection === direction.key}
              className={cn(
                "h-11 rounded panel-inset px-2 text-left flex items-center justify-between transition-colors touch-none",
                lastDirection === direction.key && "neon-border",
              )}
            >
              <span className={cn("font-display text-[10px]", direction.color)}>{direction.label}</span>
              <span className="font-mono text-[7px] text-muted-foreground tracking-wider">{direction.detail}</span>
            </button>
          ))}
        </div>
        <div className="hairline mb-3" />

        {/* 4×2 knob grid */}
        <div className="grid grid-cols-4 gap-2">
          {/* 1 — Osc Shape (categorical cycling cell) */}
          <OscShapeCell
            value={s3d.osc1.type}
            onChange={(t) => setSynth3D(p.id, { osc1: { ...s3d.osc1, type: t } })}
          />

          {/* 2 — Filter Cutoff */}
          <TactileKnob
            label="CUTOFF"
            value={s3d.filter1.freq}
            min={20} max={20000}
            defaultValue={2000}
            onChange={(v) => setSynth3D(p.id, { filter1: { ...s3d.filter1, freq: Math.round(v) } })}
            size="md" color="cyan"
            display={s3d.filter1.freq >= 1000
              ? `${(s3d.filter1.freq / 1000).toFixed(1)}k`
              : `${Math.round(s3d.filter1.freq)}`}
          />

          {/* 3 — Filter Resonance */}
          <TactileKnob
            label="RESO"
            value={s3d.filter1.q}
            min={0.1} max={20}
            defaultValue={1}
            onChange={(v) => setSynth3D(p.id, { filter1: { ...s3d.filter1, q: Math.round(v * 10) / 10 } })}
            size="md" color="cyan"
            display={`${(Math.round(s3d.filter1.q * 10) / 10).toFixed(1)}`}
          />

          {/* 4 — Attack */}
          <TactileKnob
            label="ATTACK"
            value={s3d.ampEnv.attack * 1000}
            min={1} max={5000}
            defaultValue={10}
            onChange={(v) => setSynth3D(p.id, { ampEnv: { ...s3d.ampEnv, attack: Math.round(v) / 1000 } })}
            size="md" color="magenta"
            display={`${Math.round(s3d.ampEnv.attack * 1000)}ms`}
          />

          {/* 5 — Decay */}
          <TactileKnob
            label="DECAY"
            value={s3d.ampEnv.decay * 1000}
            min={1} max={5000}
            defaultValue={200}
            onChange={(v) => setSynth3D(p.id, { ampEnv: { ...s3d.ampEnv, decay: Math.round(v) / 1000 } })}
            size="md" color="magenta"
            display={`${Math.round(s3d.ampEnv.decay * 1000)}ms`}
          />

          {/* 6 — Sustain */}
          <TactileKnob
            label="SUSTAIN"
            value={s3d.ampEnv.sustain * 100}
            min={0} max={100}
            defaultValue={70}
            onChange={(v) => setSynth3D(p.id, { ampEnv: { ...s3d.ampEnv, sustain: v / 100 } })}
            size="md" color="magenta"
            display={`${Math.round(s3d.ampEnv.sustain * 100)}%`}
          />

          {/* 7 — Release */}
          <TactileKnob
            label="RELEASE"
            value={s3d.ampEnv.release * 1000}
            min={10} max={8000}
            defaultValue={500}
            onChange={(v) => setSynth3D(p.id, { ampEnv: { ...s3d.ampEnv, release: Math.round(v) / 1000 } })}
            size="md" color="magenta"
            display={`${Math.round(s3d.ampEnv.release * 1000)}ms`}
          />

          {/* 8 — Reverb Send (resolved from the configured FX bus) */}
          <TactileKnob
            label="REVERB"
            value={reverbSend}
            min={0} max={100}
            defaultValue={0}
            onChange={(v) => {
              setReverbSend(Math.round(v));
            }}
            size="md" color="lime"
            display={reverbSendIndex === null ? "NO BUS" : `${reverbSend}%`}
            disabled={reverbSendIndex === null}
          />
        </div>
      </div>

      <InstrumentKeyboard
        partId={p.id}
        title={`KEYBOARD · ${p.name}`}
        baseOctave={4}
        gateSec={0.9}
      />

      {/* Deep editor — collapsible */}
      <div className="panel p-3">
        <button
          onClick={() => setDeepOpen((o) => !o)}
          className="w-full flex items-center justify-between font-display text-xs text-muted-foreground"
        >
          <span>DEEP EDITOR</span>
          <span className="font-mono text-[10px]">{deepOpen ? "▾" : "▸"}</span>
        </button>
        {deepOpen && (
          <div className="mt-3">
            <Synth3DSubtab />
          </div>
        )}
      </div>

      {/* Slide-in secondary panel */}
      <SecondaryPanel open={secondaryOpen} onClose={() => setSecondaryOpen(false)} />
      {/* Backdrop */}
      {secondaryOpen && (
        <div
          className="absolute inset-0 z-10 bg-background/50"
          onClick={() => setSecondaryOpen(false)}
        />
      )}
    </div>
  );
}
