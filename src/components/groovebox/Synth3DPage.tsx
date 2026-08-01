// VibeCore UI Architect — 3D Synth Instrument Page.
//
// Master prompt: "3D SYNTH — Eigene Instrumentenseite.
//   Maximal acht Parameter gleichzeitig. Keine Parameterflut."
//
// Structure: ModuleHeader → Voice picker → CORE (8 params) → deep editor.

import { useEffect } from "react";
import { useGroove } from "@/lib/store";
import { cn } from "@/lib/utils";
import { ModuleHeader } from "./ModuleHeader";
import { Synth3DSubtab } from "./Synth3DSubtab";
import { defaultSynth3D } from "@/lib/synth3d/params";

function CoreKnob({ label, value, min = 0, max = 100, step = 1, onChange, suffix }: {
  label: string; value: number; min?: number; max?: number; step?: number;
  onChange: (v: number) => void; suffix?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 panel-inset rounded-md p-2">
      <div className="font-mono text-[8px] text-muted-foreground tracking-widest">{label}</div>
      <div className="font-display text-[11px] text-primary">{Math.round(value)}{suffix ?? ""}</div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1 accent-primary touch-none" />
    </div>
  );
}

export function Synth3DPage() {
  const { parts, selectedPart, selectPart, setSynthEngine, setPartSource, setSynth3D } = useGroove();

  // Assign the 3D Synth instrument to the selected voice (only if not already 3D).
  useEffect(() => {
    const p = useGroove.getState().parts[selectedPart];
    if (p && p.synth.engine !== "3D") {
      setSynthEngine(selectedPart, "3D");
      setPartSource(selectedPart, "synth");
    }
  }, [selectedPart, setSynthEngine, setPartSource]);

  const p = parts[selectedPart];
  const s3d = p?.synth3d ?? defaultSynth3D();

  return (
    <div className="space-y-3">
      <ModuleHeader moduleName="3D SYNTH" />

      {/* Voice picker — which part this instrument drives */}
      <div className="panel p-2">
        <div className="font-mono text-[8px] text-muted-foreground tracking-widest mb-1.5">VOICE</div>
        <div className="no-scrollbar overflow-x-auto -mx-1 px-1">
          <div className="flex gap-1 min-w-max">
            {parts.map((pt) => (
              <button key={pt.id} onClick={() => selectPart(pt.id)}
                className={cn(
                  "shrink-0 h-11 min-w-[3.5rem] px-2 rounded panel-inset flex flex-col items-center justify-center gap-0.5 touch-none",
                  pt.id === selectedPart && "neon-border text-primary")}>
                <span className="text-[7px] text-muted-foreground font-mono">{String(pt.id + 1).padStart(2, "0")}</span>
                <span className="font-display text-[9px] truncate w-full text-center">{pt.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* CORE — 8 primary parameters (master prompt: max 8 simultaneously) */}
      <div className="panel p-3">
        <div className="font-display text-xs text-primary mb-2">CORE</div>
        <div className="hairline mb-2" />
        <div className="grid grid-cols-4 gap-1.5">
          <CoreKnob label="OSC LVL" value={Math.round(s3d.osc1.level * 100)}
            onChange={(v) => setSynth3D(p.id, { osc1: { ...s3d.osc1, level: v / 100 } })} suffix="%" />
          <CoreKnob label="FILTER" value={s3d.filter1.freq} min={20} max={20000} step={10}
            onChange={(v) => setSynth3D(p.id, { filter1: { ...s3d.filter1, freq: v } })} suffix="Hz" />
          <CoreKnob label="RESO Q" value={Math.round(s3d.filter1.q * 10) / 10} min={0.1} max={20} step={0.1}
            onChange={(v) => setSynth3D(p.id, { filter1: { ...s3d.filter1, q: v } })} />
          <CoreKnob label="SUB" value={Math.round(s3d.sub.level * 100)}
            onChange={(v) => setSynth3D(p.id, { sub: { ...s3d.sub, level: v / 100 } })} suffix="%" />
          <CoreKnob label="ATTACK" value={Math.round(s3d.ampEnv.attack * 1000)} min={1} max={10000} step={1}
            onChange={(v) => setSynth3D(p.id, { ampEnv: { ...s3d.ampEnv, attack: v / 1000 } })} suffix="ms" />
          <CoreKnob label="RELEASE" value={Math.round(s3d.ampEnv.release * 1000)} min={1} max={10000} step={1}
            onChange={(v) => setSynth3D(p.id, { ampEnv: { ...s3d.ampEnv, release: v / 1000 } })} suffix="ms" />
          <CoreKnob label="WIDTH" value={Math.round(s3d.spatial.width * 50)} min={0} max={200}
            onChange={(v) => setSynth3D(p.id, { spatial: { ...s3d.spatial, width: v / 50 } })} suffix="%" />
          <CoreKnob label="UNISON" value={s3d.unison.count} min={1} max={7} step={1}
            onChange={(v) => setSynth3D(p.id, { unison: { ...s3d.unison, count: v } })} />
        </div>
      </div>

      {/* Deep editor — full workflow (SOUND → OSC → FILTER → ENV → 3D → FX → SAVE) */}
      <Synth3DSubtab />
    </div>
  );
}